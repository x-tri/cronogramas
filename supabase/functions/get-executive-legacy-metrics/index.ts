import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type ProjectUser = {
  readonly role: string
  readonly school_id: string | null
}

type PrimarySchool = {
  readonly id: string
  readonly name: string | null
  readonly slug: string | null
}

type RequestPayload = {
  readonly school_id?: string | null
  readonly include_school_health?: boolean
}

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

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

function createPrimaryClient() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

async function getProjectUser(primary: ReturnType<typeof createPrimaryClient>, request: Request): Promise<ProjectUser> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw Object.assign(new Error('Missing Authorization'), { status: 401 })

  const { data: userData, error: userError } = await primary.auth.getUser(token)
  const userId = userData.user?.id
  if (userError || !userId) {
    throw Object.assign(new Error('Invalid token'), { status: 401 })
  }

  const { data, error } = await primary
    .from('project_users')
    .select('role, school_id')
    .eq('auth_uid', userId)
    .eq('is_active', true)
    .order('role', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw Object.assign(new Error('Falha ao validar permissões.'), { status: 500 })
  }
  if (!data) {
    throw Object.assign(new Error('Usuário sem vínculo ativo.'), { status: 403 })
  }

  return data as ProjectUser
}

async function getPrimarySchool(
  primary: ReturnType<typeof createPrimaryClient>,
  schoolId: string | null,
): Promise<PrimarySchool | null> {
  if (!schoolId) return null

  const { data, error } = await primary
    .from('schools')
    .select('id, name, slug')
    .eq('id', schoolId)
    .maybeSingle()

  if (error) {
    throw Object.assign(new Error('Falha ao localizar escola no PRIMARY.'), { status: 500 })
  }

  return data as PrimarySchool | null
}

async function fetchLegacyBridge(
  primarySchool: PrimarySchool | null,
  includeSchoolHealth: boolean,
): Promise<Record<string, unknown>> {
  const legacyUrl = getEnv('SIMULADO_SUPABASE_URL').replace(/\/+$/, '')
  const bridgeSecret = getEnv('EXECUTIVE_LEGACY_BRIDGE_SECRET')
  const response = await fetch(`${legacyUrl}/functions/v1/get-executive-legacy-metrics-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-function-secret': bridgeSecret,
    },
    body: JSON.stringify({
      primary_school: primarySchool,
      include_school_health: includeSchoolHealth,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : 'Falha ao ler métricas no LEGACY.'
    throw Object.assign(new Error(message), { status: 502 })
  }

  return payload as Record<string, unknown>
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as RequestPayload
    const primary = createPrimaryClient()
    const projectUser = await getProjectUser(primary, request)

    const requestedSchoolId = payload.school_id ?? null
    const effectiveSchoolId =
      projectUser.role === 'super_admin' ? requestedSchoolId : projectUser.school_id

    if (projectUser.role !== 'super_admin' && !effectiveSchoolId) {
      throw Object.assign(new Error('Usuário sem escola vinculada.'), { status: 403 })
    }
    if (
      projectUser.role !== 'super_admin' &&
      requestedSchoolId &&
      requestedSchoolId !== projectUser.school_id
    ) {
      throw Object.assign(new Error('Acesso negado para outra escola.'), { status: 403 })
    }

    const primarySchool = await getPrimarySchool(primary, effectiveSchoolId)
    if (effectiveSchoolId && !primarySchool) {
      throw Object.assign(new Error('Escola não encontrada no PRIMARY.'), { status: 404 })
    }

    const legacyPayload = await fetchLegacyBridge(
      primarySchool,
      payload.include_school_health === true,
    )

    return jsonResponse(200, legacyPayload)
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    return jsonResponse(status, { error: message })
  }
})
