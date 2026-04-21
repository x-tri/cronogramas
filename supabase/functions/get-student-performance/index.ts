/**
 * get-student-performance — Unified view of a student's simulado history
 * across legacy (axtmozyrnsrhqrnktshz.projetos) and cronogramas (simulado_respostas).
 *
 * Input (POST body):
 *   { student_id: uuid }
 *     OR
 *   { matricula: string, school_id: uuid }
 *
 * Output: StudentPerformanceResponse (see below)
 *
 * Guardrails (from integrity audit):
 *   G1. Use tri_scores_by_area (project-level) — areaScores in student blob is always zero.
 *   G2. Use tri_scores (project-level) as authoritative — triScore in blob is inconsistent.
 *   G3. Flag tri_estimado per-area for students who skipped dia1/dia2 (scores hit floor).
 *   G4. Tag format 'tipo2_45' when answer_key < 180 — different analysis path downstream.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Types (inlined to keep edge function self-contained for MCP deploy)
// =============================================================================

type SimuladoFonte = 'legacy' | 'cronogramas'
type SimuladoFormato = 'enem_180' | 'tipo2_45'

interface TriScores {
  readonly lc: number
  readonly ch: number
  readonly cn: number
  readonly mt: number
}

interface TriEstimadoFlags {
  readonly lc: boolean
  readonly ch: boolean
  readonly cn: boolean
  readonly mt: boolean
}

interface Acertos {
  readonly lc: number
  readonly ch: number
  readonly cn: number
  readonly mt: number
}

interface SimuladoPerformance {
  readonly fonte: SimuladoFonte
  readonly simulado_id: string
  readonly simulado_nome: string
  readonly data: string
  readonly formato: SimuladoFormato
  readonly fez_dia1: boolean
  readonly fez_dia2: boolean
  readonly tri: TriScores
  readonly tri_estimado: TriEstimadoFlags
  readonly acertos: Acertos
  readonly answers: readonly string[]
  readonly tri_total: number
}

interface StudentPerformanceResponse {
  readonly student_id: string
  readonly matricula: string
  readonly school_id: string
  readonly performances: readonly SimuladoPerformance[]
  readonly fontes_utilizadas: readonly SimuladoFonte[]
  readonly legacy_status: 'ok' | 'fallback' | 'disabled'
  readonly cronogramas_status: 'ok' | 'fallback'
  readonly fetched_at: string
}

/**
 * TRI floor values observed in audit.
 *
 * Audit raw data for students without dia1/dia2:
 *   - CN/MT floor observed: 308.5 (MT) and 339.9 (CN) — range 308–340
 *   - CH/LC floor observed: 299.6 (LC) and 329.8 (CH) — range 299–330
 *
 * We use strict `<` comparison with a ceiling just ABOVE the observed floor range
 * to avoid false-positives on legitimate borderline scores. A student who scored
 * exactly 340 in MT is genuinely borderline, not a floor-estimated score.
 */
const TRI_FLOOR_CN_MT = 340
const TRI_FLOOR_CH_LC = 330

/** Find tri_scores/tri_scores_by_area key for a given matricula. */
function findKeyForMatricula(
  obj: Record<string, unknown> | null | undefined,
  matricula: string,
): string | null {
  if (!obj) return null
  const prefixes = [`merged-${matricula}-`, `manual-${matricula}-`]
  for (const key of Object.keys(obj)) {
    if (prefixes.some((p) => key.startsWith(p))) return key
  }
  return null
}

// =============================================================================
// HTTP helpers
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string, ...fallbacks: string[]): string {
  const value =
    Deno.env.get(name) ??
    fallbacks.map((f) => Deno.env.get(f)).find((v) => v && v.length > 0)
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`)
  }
  return value
}

function createPrimaryClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function tryCreateLegacyClient(): SupabaseClient | null {
  const primaryUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? ''
  const legacyUrl =
    Deno.env.get('SIMULADO_SUPABASE_URL') ??
    Deno.env.get('VITE_SIMULADO_SUPABASE_URL') ??
    ''
  const legacyKey =
    Deno.env.get('SIMULADO_SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SIMULADO_SUPABASE_KEY') ??
    Deno.env.get('VITE_SIMULADO_SUPABASE_KEY') ??
    ''

  if (!legacyUrl || !legacyKey || legacyUrl === primaryUrl) {
    return null
  }

  return createClient(legacyUrl, legacyKey, { auth: { persistSession: false } })
}

// =============================================================================
// Legacy: projetos → SimuladoPerformance
// =============================================================================

type LegacyAluno = {
  id?: string
  // H4: JSONB blob can use any of these field names depending on upload era.
  studentNumber?: string
  student_number?: string
  matricula?: string
  studentName?: string
  turma?: string
  answers?: string[]
  fezDia1?: boolean
  fezDia2?: boolean
  areaCorrectAnswers?: { CH?: number; CN?: number; LC?: number; MT?: number }
}

/**
 * H4 fix: resolve aluno blob by matching ANY of the possible matricula fields.
 * Also tries extracting matricula from the `id` pattern "merged-MATRICULA-..." or "manual-MATRICULA-...".
 */
function findAlunoInProjeto(
  students: readonly LegacyAluno[] | null | undefined,
  matricula: string,
): LegacyAluno | undefined {
  if (!students) return undefined
  return students.find((s) => {
    if (s.studentNumber === matricula) return true
    if (s.student_number === matricula) return true
    if (s.matricula === matricula) return true
    if (typeof s.id === 'string') {
      const m = s.id.match(/^(?:merged|manual)-([^-]+)-\d+$/)
      if (m && m[1] === matricula) return true
    }
    return false
  })
}

type LegacyProjeto = {
  id: string
  nome: string
  school_id: string
  created_at: string
  students: LegacyAluno[] | null
  answer_key: string[] | null
  tri_scores: Record<string, number> | null
  tri_scores_by_area: Record<string, { CH: number; CN: number; LC: number; MT: number }> | null
}

function normalizeProjeto(
  p: LegacyProjeto,
  matricula: string,
): SimuladoPerformance | null {
  // H3 fix: null-guard before call
  if (!p.tri_scores_by_area) return null

  // G1 + G2: authoritative TRI comes from project-level columns
  const key = findKeyForMatricula(p.tri_scores_by_area as Record<string, unknown>, matricula)
  if (!key) return null

  const triArea = p.tri_scores_by_area[key]

  // H4: aluno blob may use studentNumber / student_number / matricula / id suffix
  const aluno = findAlunoInProjeto(p.students, matricula)

  // G4: detect TIPO 2 format (45 questões) vs ENEM padrão (180)
  const keyLen = p.answer_key?.length ?? 0
  const formato: SimuladoFormato = keyLen > 0 && keyLen < 180 ? 'tipo2_45' : 'enem_180'

  // G3: flag estimado scores.
  // M4 fix: when aluno blob is absent, default fezDia1/fezDia2 to `null` semantics
  //         — we can't tell, so we rely ONLY on the floor threshold to decide.
  const fezDia1Known = typeof aluno?.fezDia1 === 'boolean'
  const fezDia2Known = typeof aluno?.fezDia2 === 'boolean'
  const fezDia1 = fezDia1Known ? (aluno!.fezDia1 as boolean) : true
  const fezDia2 = fezDia2Known ? (aluno!.fezDia2 as boolean) : true

  const triLC = Number(triArea.LC ?? 0)
  const triCH = Number(triArea.CH ?? 0)
  const triCN = Number(triArea.CN ?? 0)
  const triMT = Number(triArea.MT ?? 0)

  // M1 fix: use strict `<` on the observed-floor ceiling
  const triEstimado: TriEstimadoFlags = {
    lc: (fezDia1Known && !fezDia1) || triLC < TRI_FLOOR_CH_LC,
    ch: (fezDia1Known && !fezDia1) || triCH < TRI_FLOOR_CH_LC,
    cn: (fezDia2Known && !fezDia2) || triCN < TRI_FLOOR_CN_MT,
    mt: (fezDia2Known && !fezDia2) || triMT < TRI_FLOOR_CN_MT,
  }

  // M3 fix: fallback to per-area mean when project-level tri_scores lookup is missing
  const triTotalRaw = p.tri_scores?.[key]
  const triTotal =
    typeof triTotalRaw === 'number' && Number.isFinite(triTotalRaw) && triTotalRaw > 0
      ? triTotalRaw
      : (triLC + triCH + triCN + triMT) / 4

  const acertos = aluno?.areaCorrectAnswers ?? {}
  return {
    fonte: 'legacy',
    simulado_id: p.id,
    simulado_nome: p.nome,
    data: p.created_at,
    formato,
    fez_dia1: fezDia1,
    fez_dia2: fezDia2,
    tri: { lc: triLC, ch: triCH, cn: triCN, mt: triMT },
    tri_estimado: triEstimado,
    acertos: {
      lc: Number(acertos.LC ?? 0),
      ch: Number(acertos.CH ?? 0),
      cn: Number(acertos.CN ?? 0),
      mt: Number(acertos.MT ?? 0),
    },
    answers: Array.isArray(aluno?.answers) ? (aluno!.answers as string[]) : [],
    tri_total: triTotal,
  }
}

async function fetchLegacyPerformances(
  legacyClient: SupabaseClient,
  schoolId: string,
  matricula: string,
): Promise<SimuladoPerformance[]> {
  // Uses SECURITY DEFINER RPC that filters server-side by matricula+school_id.
  // RLS on projetos blocks anon direct reads; the RPC is safe because it only
  // returns rows where the given matricula exists in tri_scores_by_area keys.
  const { data, error } = await legacyClient.rpc('get_student_simulado_history', {
    p_matricula: matricula,
    p_school_id: schoolId,
  })

  if (error) throw error

  return ((data ?? []) as LegacyProjeto[])
    .map((p) => normalizeProjeto(p, matricula))
    .filter((v): v is SimuladoPerformance => v !== null)
}

// =============================================================================
// Cronogramas: simulado_respostas → SimuladoPerformance
// =============================================================================

type CronogramasRespostaRow = {
  id: string
  simulado_id: string
  student_id: string
  answers: unknown
  tri_lc: number | null
  tri_ch: number | null
  tri_cn: number | null
  tri_mt: number | null
  acertos_lc: number | null
  acertos_ch: number | null
  acertos_cn: number | null
  acertos_mt: number | null
  submitted_at: string
  simulados:
    | {
        id: string
        title: string | null
        published_at: string | null
      }
    | null
}

function normalizeCronogramasRow(row: CronogramasRespostaRow): SimuladoPerformance {
  // L5 fix: verify each element is a string
  const answersRaw = Array.isArray(row.answers) ? row.answers : []
  const answers = (answersRaw as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  )

  // M2 fix: answers.length is NOT a reliable signal of format — students may skip questions.
  // simulado_respostas has no answer_key. Default to 'enem_180' unless joined simulados
  // table indicates otherwise. Future: join simulados.tipo or simulado_itens count.
  const formato: SimuladoFormato = 'enem_180'

  const tri: TriScores = {
    lc: Number(row.tri_lc ?? 0),
    ch: Number(row.tri_ch ?? 0),
    cn: Number(row.tri_cn ?? 0),
    mt: Number(row.tri_mt ?? 0),
  }
  // M1 fix: strict `<` on observed floor ceiling
  const triEstimado: TriEstimadoFlags = {
    lc: tri.lc > 0 && tri.lc < TRI_FLOOR_CH_LC,
    ch: tri.ch > 0 && tri.ch < TRI_FLOOR_CH_LC,
    cn: tri.cn > 0 && tri.cn < TRI_FLOOR_CN_MT,
    mt: tri.mt > 0 && tri.mt < TRI_FLOOR_CN_MT,
  }
  const triTotal = (tri.lc + tri.ch + tri.cn + tri.mt) / 4

  return {
    fonte: 'cronogramas',
    simulado_id: row.simulado_id,
    simulado_nome: row.simulados?.title ?? 'Simulado',
    data: row.submitted_at,
    formato,
    // L1: cronogramas schema has no fez_dia1/fez_dia2 columns. We assume both days
    // completed — the submit-simulado flow requires all answers for each submission.
    fez_dia1: true,
    fez_dia2: true,
    tri,
    tri_estimado: triEstimado,
    acertos: {
      lc: Number(row.acertos_lc ?? 0),
      ch: Number(row.acertos_ch ?? 0),
      cn: Number(row.acertos_cn ?? 0),
      mt: Number(row.acertos_mt ?? 0),
    },
    answers,
    tri_total: triTotal,
  }
}

async function fetchCronogramasPerformances(
  primary: SupabaseClient,
  studentId: string,
): Promise<SimuladoPerformance[]> {
  const { data, error } = await primary
    .from('simulado_respostas')
    .select(`
      id, simulado_id, student_id, answers,
      tri_lc, tri_ch, tri_cn, tri_mt,
      acertos_lc, acertos_ch, acertos_cn, acertos_mt,
      submitted_at,
      simulados:simulado_id ( id, title, published_at )
    `)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as CronogramasRespostaRow[]).map(normalizeCronogramasRow)
}

// =============================================================================
// Resolve student
// =============================================================================

async function resolveStudent(
  primary: SupabaseClient,
  input: { student_id?: string; matricula?: string; school_id?: string },
): Promise<{ id: string; matricula: string; school_id: string }> {
  if (input.student_id) {
    const { data, error } = await primary
      .from('students')
      .select('id, matricula, school_id')
      .eq('id', input.student_id)
      .single()
    if (error || !data) throw new Error(`Aluno não encontrado: ${input.student_id}`)
    return { id: data.id, matricula: data.matricula, school_id: data.school_id }
  }

  if (input.matricula && input.school_id) {
    const { data, error } = await primary
      .from('students')
      .select('id, matricula, school_id')
      .eq('matricula', input.matricula)
      .eq('school_id', input.school_id)
      .single()
    if (error || !data)
      throw new Error(`Aluno não encontrado: ${input.matricula}/${input.school_id}`)
    return { id: data.id, matricula: data.matricula, school_id: data.school_id }
  }

  throw new Error('Forneça student_id OU (matricula + school_id)')
}

// =============================================================================
// Handler
// =============================================================================

/**
 * H1 identity check (Phase 4 complete).
 *
 * Called in 3 scenarios:
 *   A) Server-to-server (role=service_role in JWT) → trust, skip check.
 *   B) Admin/coordinator (project_users.role = super_admin | coordinator):
 *        - super_admin: read any student
 *        - coordinator: read students of their own school
 *   C) Student (user JWT with sub matching students.profile_id): self only.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '==='.slice((payload.length + 3) % 4)
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

async function assertCanReadStudent(
  primary: SupabaseClient,
  req: Request,
  studentId: string,
  studentSchoolId: string,
): Promise<void> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw Object.assign(new Error('Missing Authorization'), { status: 401 })
  }
  const claims = parseJwtPayload(token)
  const role = (claims?.role ?? '') as string

  // A) Server-to-server — trust.
  if (role === 'service_role') return

  const sub = (claims?.sub ?? '') as string
  if (!sub) {
    throw Object.assign(new Error('Invalid token: missing sub'), { status: 401 })
  }

  // B) Admin/coordinator lookup in project_users (uses service_role client, so bypasses RLS).
  const { data: projectUser } = await primary
    .from('project_users')
    .select('role, school_id, is_active')
    .eq('auth_uid', sub)
    .eq('is_active', true)
    .maybeSingle()

  if (projectUser?.role === 'super_admin') return

  if (projectUser?.role === 'coordinator') {
    if (!projectUser.school_id) {
      throw Object.assign(
        new Error('Coordenador sem escola associada'),
        { status: 403 },
      )
    }
    if (projectUser.school_id !== studentSchoolId) {
      throw Object.assign(
        new Error('Forbidden: coordenador só acessa alunos da própria escola'),
        { status: 403 },
      )
    }
    return
  }

  // C) Aluno — só pode ler a própria ficha.
  const { data: studentRow, error } = await primary
    .from('students')
    .select('profile_id')
    .eq('id', studentId)
    .maybeSingle()
  if (error) {
    throw Object.assign(
      new Error(`Identity check failed: ${error.message}`),
      { status: 500 },
    )
  }
  if (!studentRow || studentRow.profile_id !== sub) {
    throw Object.assign(
      new Error('Forbidden: você só pode consultar seus próprios dados'),
      { status: 403 },
    )
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  let body: { student_id?: string; matricula?: string; school_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Body inválido (JSON esperado)' })
  }

  try {
    const primary = createPrimaryClient()
    const legacyClient = tryCreateLegacyClient()

    const student = await resolveStudent(primary, body)

    // H1: enforce identity — throws on unauthorized cross-student reads.
    // Admin/coordinator access validated against project_users.role.
    await assertCanReadStudent(primary, req, student.id, student.school_id)

    const legacyPromise: Promise<SimuladoPerformance[] | null> = legacyClient
      ? fetchLegacyPerformances(legacyClient, student.school_id, student.matricula).catch(
          (err: Error) => {
            console.warn('[get-student-performance] legacy fetch failed:', err.message)
            return null
          },
        )
      : Promise.resolve(null)

    // H2 fix: cronogramas failure degrades gracefully too.
    const cronogramasPromise: Promise<SimuladoPerformance[] | null> =
      fetchCronogramasPerformances(primary, student.id).catch((err: Error) => {
        console.warn('[get-student-performance] cronogramas fetch failed:', err.message)
        return null
      })

    const [legacyResult, cronogramasResult] = await Promise.all([legacyPromise, cronogramasPromise])

    // M7 fix: parse to Date for robust chronological sort
    const performances = [...(legacyResult ?? []), ...(cronogramasResult ?? [])].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
    )

    // M5 fix: build as immutable array at construction time
    const fontes_utilizadas: readonly SimuladoFonte[] = [
      ...(legacyResult && legacyResult.length > 0 ? (['legacy'] as const) : []),
      ...(cronogramasResult && cronogramasResult.length > 0 ? (['cronogramas'] as const) : []),
    ]

    const legacy_status: StudentPerformanceResponse['legacy_status'] = !legacyClient
      ? 'disabled'
      : legacyResult === null
        ? 'fallback'
        : 'ok'

    const cronogramas_status: StudentPerformanceResponse['cronogramas_status'] =
      cronogramasResult === null ? 'fallback' : 'ok'

    const response: StudentPerformanceResponse = {
      student_id: student.id,
      matricula: student.matricula,
      school_id: student.school_id,
      performances,
      fontes_utilizadas,
      legacy_status,
      cronogramas_status,
      fetched_at: new Date().toISOString(),
    }

    return jsonResponse(200, response as unknown as Record<string, unknown>)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    const status =
      typeof (err as { status?: number }).status === 'number'
        ? (err as { status: number }).status
        : /não encontrado/i.test(message)
          ? 404
          : /forne\u00e7a/i.test(message)
            ? 400
            : 500
    // Avoid leaking raw DB error shapes — log full, return sanitized
    console.error('[get-student-performance] error:', message)
    return jsonResponse(status, { error: message })
  }
})
