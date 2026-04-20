/**
 * Handler de submissao de simulado (Fase 2).
 *
 * Logica pura e isolada do transporte HTTP. A Edge Function
 * `supabase/functions/submit-simulado/index.ts` e um wrapper fino que cria
 * o supabase client com service_role e delega para `submitSimulado()` aqui.
 *
 * Testabilidade: pode ser executado contra uma instancia real de Postgres
 * via Vitest (ver submit-simulado.test.ts) ou com um client mockado.
 *
 * Autoridade: usa `service_role` para bypass de RLS ao ler `simulado_itens`
 * (que e oculta para alunos) e escrever `simulado_respostas`. A validacao
 * de quem pode submeter acontece aqui, baseado no `studentId` ja resolvido
 * upstream (via JWT).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  calcAllTRI,
  calcTotals,
  groupErrorsBy,
  type TriResults,
} from './tri-engine/engine.ts'
import { AREAS, type AreaKey } from './tri-engine/reference-tables.ts'

// ---------------------------------------------------------------------------
// Input schema (validacao runtime)
// ---------------------------------------------------------------------------

/**
 * Schema do payload: simulado_id UUID + map limitado de respostas.
 * - answers: max 180 chaves (ENEM completo), valores com max 1 caractere.
 * - Validacao semantica (A-E, numero 1..180) fica no handler para retornar
 *   mensagens mais uteis que "invalid_payload".
 */
export const submitPayloadSchema = z.object({
  simulado_id: z.string().uuid('simulado_id deve ser UUID'),
  answers: z
    .record(z.string().min(1).max(3), z.string().max(1))
    .refine((obj) => Object.keys(obj).length <= 180, {
      message: 'answers deve ter no maximo 180 chaves',
    }),
})

export type SubmitPayload = z.infer<typeof submitPayloadSchema>

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export interface SubmitResult {
  readonly resposta_id: string
  readonly tri: Record<AreaKey, number | null>
  readonly totais: {
    readonly acertos: number
    readonly erros: number
    readonly branco: number
    readonly respondidas: number
  }
  readonly por_area: Record<
    AreaKey,
    { readonly acertos: number; readonly erros: number; readonly branco: number }
  >
  readonly erros_por_topico: Record<string, number>
  readonly erros_por_habilidade: Record<string, number>
  readonly submitted_at: string
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export interface PayloadIssue {
  readonly path: string
  readonly message: string
}

export type SubmitError =
  | { kind: 'invalid_payload'; issues: readonly PayloadIssue[] }
  | { kind: 'simulado_not_found' }
  | { kind: 'simulado_not_published' }
  | { kind: 'student_not_eligible' }
  | { kind: 'already_submitted'; submitted_at: string }
  | { kind: 'itens_invalidos'; esperado: number; encontrado: number }
  | { kind: 'db_error'; message: string }

export type Outcome<T, E> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T>(data: T): Outcome<T, never> => ({ ok: true, data })
export const fail = <E>(error: E): Outcome<never, E> => ({ ok: false, error })

// ---------------------------------------------------------------------------
// Tipos das tabelas (subset relevante)
// ---------------------------------------------------------------------------

interface SimuladoRow {
  readonly id: string
  readonly status: 'draft' | 'published' | 'closed'
  readonly school_id: string
  readonly turmas: string[]
}

interface StudentRow {
  readonly id: string
  readonly school_id: string
  readonly turma: string | null
}

interface SimuladoItemRow {
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade: number
  readonly topico: string | null
  readonly habilidade: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_ITEMS = 180

/**
 * Converte `{ "1": "A", "2": "B", ... }` em array de 180 letras em ordem.
 * Valores ausentes, nulos ou nao-A-E viram "" (branco).
 */
export function answersMapToArray(
  answers: Readonly<Record<string, string>>,
): string[] {
  const out: string[] = new Array(TOTAL_ITEMS).fill('')
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const raw = answers[String(i + 1)]
    if (typeof raw !== 'string') continue
    const v = raw.toUpperCase().trim()
    if (v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E') {
      out[i] = v
    }
  }
  return out
}

/** Extrai o score arredondado de uma area; null se area nao tem resultado. */
function scoreOf(results: TriResults, area: AreaKey): number | null {
  const r = results[area]
  return r ? r.score : null
}

/** Computa acertos/erros/branco por area a partir do array de respostas. */
function computeAreaBreakdown(
  answers: readonly string[],
  gabarito: readonly string[],
): Record<AreaKey, { acertos: number; erros: number; branco: number }> {
  const empty = (): { acertos: number; erros: number; branco: number } => ({
    acertos: 0,
    erros: 0,
    branco: 0,
  })
  const out: Record<AreaKey, { acertos: number; erros: number; branco: number }> = {
    LC: empty(),
    CH: empty(),
    CN: empty(),
    MT: empty(),
  }
  for (const area of AREAS) {
    const start = area.range[0] - 1
    const end = area.range[1]
    for (let i = start; i < end; i++) {
      const a = (answers[i] ?? '').toUpperCase().trim()
      if (!a) {
        out[area.key].branco++
        continue
      }
      const g = (gabarito[i] ?? '').toUpperCase().trim()
      if (a === g) out[area.key].acertos++
      else out[area.key].erros++
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

export interface SubmitSimuladoParams {
  /** Supabase client com service_role — bypassa RLS para ler itens + inserir. */
  readonly client: SupabaseClient
  /** UUID do student ja resolvido via JWT upstream. */
  readonly studentId: string
  /** Payload bruto (sera validado internamente). */
  readonly payload: unknown
}

export async function submitSimulado(
  params: SubmitSimuladoParams,
): Promise<Outcome<SubmitResult, SubmitError>> {
  // 1. Valida payload
  const parsed = submitPayloadSchema.safeParse(params.payload)
  if (!parsed.success) {
    const issues: PayloadIssue[] = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }))
    return fail({ kind: 'invalid_payload', issues })
  }

  const { client, studentId } = params
  const { simulado_id, answers } = parsed.data

  // 2. Carrega student (escopo escola/turma)
  const studentRes = await client
    .from('students')
    .select('id, school_id, turma')
    .eq('id', studentId)
    .maybeSingle<StudentRow>()

  if (studentRes.error) return fail({ kind: 'db_error', message: studentRes.error.message })
  if (!studentRes.data) return fail({ kind: 'student_not_eligible' })

  const student = studentRes.data

  // 3. Carrega simulado e valida status + escopo
  const simRes = await client
    .from('simulados')
    .select('id, status, school_id, turmas')
    .eq('id', simulado_id)
    .maybeSingle<SimuladoRow>()

  if (simRes.error) return fail({ kind: 'db_error', message: simRes.error.message })
  if (!simRes.data) return fail({ kind: 'simulado_not_found' })

  const simulado = simRes.data

  if (simulado.status !== 'published') {
    return fail({ kind: 'simulado_not_published' })
  }
  if (simulado.school_id !== student.school_id) {
    return fail({ kind: 'student_not_eligible' })
  }
  if (
    simulado.turmas.length > 0 &&
    (student.turma === null || !simulado.turmas.includes(student.turma))
  ) {
    return fail({ kind: 'student_not_eligible' })
  }

  // 4. Valida que nao submeteu ainda
  const prevRes = await client
    .from('simulado_respostas')
    .select('id, submitted_at')
    .eq('simulado_id', simulado_id)
    .eq('student_id', studentId)
    .maybeSingle<{ id: string; submitted_at: string }>()

  if (prevRes.error) return fail({ kind: 'db_error', message: prevRes.error.message })
  if (prevRes.data) {
    return fail({ kind: 'already_submitted', submitted_at: prevRes.data.submitted_at })
  }

  // 5. Carrega todos os itens (requer service_role para bypassar RLS aluno)
  const itensRes = await client
    .from('simulado_itens')
    .select('numero, area, gabarito, dificuldade, topico, habilidade')
    .eq('simulado_id', simulado_id)
    .order('numero', { ascending: true })

  if (itensRes.error) return fail({ kind: 'db_error', message: itensRes.error.message })
  const itens = (itensRes.data ?? []) as SimuladoItemRow[]

  if (itens.length !== TOTAL_ITEMS) {
    return fail({ kind: 'itens_invalidos', esperado: TOTAL_ITEMS, encontrado: itens.length })
  }

  // 6. Monta arrays na ordem do numero (1..180 = indice 0..179)
  const gabarito: string[] = new Array(TOTAL_ITEMS).fill('')
  const difficulties: number[] = new Array(TOTAL_ITEMS).fill(3)
  const topicos: (string | null)[] = new Array(TOTAL_ITEMS).fill(null)
  const habilidades: (string | null)[] = new Array(TOTAL_ITEMS).fill(null)

  for (const item of itens) {
    const idx = item.numero - 1
    if (idx < 0 || idx >= TOTAL_ITEMS) continue
    gabarito[idx] = item.gabarito
    difficulties[idx] = item.dificuldade
    topicos[idx] = item.topico
    habilidades[idx] = item.habilidade
  }

  const answersArray = answersMapToArray(answers)

  // 7. Calcula TRI + totais + mapas de erro
  const tri = calcAllTRI(answersArray, { gabarito, difficulties })
  const totais = calcTotals(answersArray, gabarito)
  const porArea = computeAreaBreakdown(answersArray, gabarito)
  const errosPorTopico = groupErrorsBy(answersArray, gabarito, topicos)
  const errosPorHabilidade = groupErrorsBy(answersArray, gabarito, habilidades)

  // 8. Persiste (RLS bypassada via service_role).
  //    Se houver corrida com step 4, o UNIQUE (simulado_id, student_id) vai
  //    disparar 23505 — tratamos remapeando para already_submitted em vez de
  //    devolver um db_error generico ao cliente.
  const insertRes = await client
    .from('simulado_respostas')
    .insert({
      simulado_id,
      student_id: studentId,
      answers,
      tri_lc: scoreOf(tri, 'LC'),
      tri_ch: scoreOf(tri, 'CH'),
      tri_cn: scoreOf(tri, 'CN'),
      tri_mt: scoreOf(tri, 'MT'),
      acertos_lc: porArea.LC.acertos, erros_lc: porArea.LC.erros, branco_lc: porArea.LC.branco,
      acertos_ch: porArea.CH.acertos, erros_ch: porArea.CH.erros, branco_ch: porArea.CH.branco,
      acertos_cn: porArea.CN.acertos, erros_cn: porArea.CN.erros, branco_cn: porArea.CN.branco,
      acertos_mt: porArea.MT.acertos, erros_mt: porArea.MT.erros, branco_mt: porArea.MT.branco,
      erros_por_topico: errosPorTopico,
      erros_por_habilidade: errosPorHabilidade,
    })
    .select('id, submitted_at')
    .single<{ id: string; submitted_at: string }>()

  if (insertRes.error) {
    // PostgreSQL unique_violation (SQLSTATE 23505) = corrida perdida.
    if (insertRes.error.code === '23505') {
      const existingRes = await client
        .from('simulado_respostas')
        .select('submitted_at')
        .eq('simulado_id', simulado_id)
        .eq('student_id', studentId)
        .maybeSingle<{ submitted_at: string }>()
      return fail({
        kind: 'already_submitted',
        submitted_at: existingRes.data?.submitted_at ?? new Date().toISOString(),
      })
    }
    return fail({ kind: 'db_error', message: insertRes.error.message })
  }

  return ok({
    resposta_id: insertRes.data.id,
    tri: {
      LC: scoreOf(tri, 'LC'),
      CH: scoreOf(tri, 'CH'),
      CN: scoreOf(tri, 'CN'),
      MT: scoreOf(tri, 'MT'),
    },
    totais,
    por_area: porArea,
    erros_por_topico: errosPorTopico,
    erros_por_habilidade: errosPorHabilidade,
    submitted_at: insertRes.data.submitted_at,
  })
}
