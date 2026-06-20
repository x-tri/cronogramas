import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type PrimarySchool = {
  readonly id: string
  readonly name: string | null
  readonly slug: string | null
}

type LegacySchoolActivity = {
  readonly school_id: string
  readonly escola: string | null
  readonly slug: string | null
  readonly alunos_base: number
  readonly alunos_com_simulado: number
  readonly alunos_com_cronograma: number
  readonly alunos_atendidos: number
  readonly cronogramas_gerados: number
  readonly blocos_criados: number
  readonly downloads_listas: number
  readonly alunos_com_download: number
  readonly escola_ativa: boolean
}

type RequestPayload = {
  readonly primary_school?: PrimarySchool | null
  readonly include_school_health?: boolean
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-function-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

function createLegacyClient() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

function normalizeSchoolKey(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return key.length > 0 ? key : null
}

function schoolKeys(row: { readonly school_id?: unknown; readonly escola?: unknown; readonly slug?: unknown }): string[] {
  const keys: string[] = []
  if (typeof row.school_id === 'string' && row.school_id.trim()) {
    keys.push(`id:${row.school_id.trim()}`)
  }

  for (const value of [row.slug, row.escola]) {
    const key = normalizeSchoolKey(value)
    if (key) keys.push(`key:${key}`)
  }

  return Array.from(new Set(keys))
}

function matchLegacySchool(
  rows: readonly LegacySchoolActivity[],
  primarySchool: PrimarySchool | null,
): LegacySchoolActivity | null {
  if (!primarySchool) return null

  const targetKeys = new Set(
    schoolKeys({
      school_id: primarySchool.id,
      escola: primarySchool.name,
      slug: primarySchool.slug,
    }),
  )

  return rows.find((row) => schoolKeys(row).some((key) => targetKeys.has(key))) ?? null
}

function assertInternalRequest(request: Request): void {
  const expectedSecret = getEnv('EXECUTIVE_LEGACY_BRIDGE_SECRET')
  const receivedSecret = request.headers.get('x-internal-function-secret') ?? ''
  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    assertInternalRequest(request)

    const payload = (await request.json().catch(() => ({}))) as RequestPayload
    const legacy = createLegacyClient()
    const primarySchool = payload.primary_school ?? null

    const { data: schoolRows, error: schoolRowsError } = await legacy
      .from('executive_school_activity')
      .select(
        'school_id, escola, slug, alunos_base, alunos_com_simulado, alunos_com_cronograma, alunos_atendidos, cronogramas_gerados, blocos_criados, downloads_listas, alunos_com_download, escola_ativa',
      )

    if (schoolRowsError) {
      throw Object.assign(new Error('Falha ao ler escolas no LEGACY.'), { status: 502 })
    }

    const allSchools = ((schoolRows ?? []) as LegacySchoolActivity[])
      .filter((row) => !/^teste/i.test(String(row.escola ?? '').trim()))
    const scopedSchool = matchLegacySchool(allSchools, primarySchool)
    const activeSchools = allSchools.filter((row) => row.escola_ativa)
    const schools = primarySchool
      ? scopedSchool ? [scopedSchool] : []
      : payload.include_school_health ? activeSchools : []

    const { data: storage, error: storageError } = await legacy
      .from('executive_storage_metrics')
      .select('storage_objects, storage_bytes')
      .maybeSingle()

    if (storageError) {
      throw Object.assign(new Error('Falha ao ler storage no LEGACY.'), { status: 502 })
    }

    const metrics = primarySchool
      ? scopedSchool
      : await legacy
        .from('executive_operation_metrics')
        .select('*')
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw Object.assign(new Error('Falha ao ler métricas no LEGACY.'), { status: 502 })
          return data
        })

    return jsonResponse(200, {
      source: 'legacy',
      metrics: metrics ?? null,
      storage: storage ?? null,
      schools,
      matched_school_id: scopedSchool?.school_id ?? null,
    })
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    return jsonResponse(status, { error: message })
  }
})
