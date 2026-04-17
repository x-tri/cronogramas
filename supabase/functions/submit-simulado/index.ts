/**
 * Edge Function `submit-simulado` — wrapper HTTP sobre o handler em
 * `src/services/simulado/submit-simulado.ts`.
 *
 * Fluxo:
 *   1. Recebe POST com JSON `{ simulado_id, answers }`.
 *   2. Extrai JWT do header Authorization: Bearer <token>.
 *   3. Usa um cliente anon com o JWT para descobrir `auth.uid()`.
 *   4. Busca o student pelo profile_id para resolver studentId.
 *   5. Delega para submitSimulado() com um cliente service_role
 *      (bypassa RLS em simulado_itens e simulado_respostas).
 *   6. Retorna 200 com o resultado, ou 4xx/5xx com codigo de erro estruturado.
 *
 * O motor TRI e reusado do src/services/simulado/tri-engine/ — nao ha
 * duplicacao de codigo entre Vitest (primary) e Deno (edge).
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

import {
  submitSimulado,
  type SubmitError,
  type SubmitResult,
  type Outcome,
} from '../../../src/services/simulado/submit-simulado.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRequiredEnv(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? (fallback ? Deno.env.get(fallback) : undefined)
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`)
  return value
}

function errorToHttp(err: SubmitError): { status: number; body: Record<string, unknown> } {
  switch (err.kind) {
    case 'invalid_payload':
      return { status: 400, body: { error: 'invalid_payload', issues: err.issues } }
    case 'simulado_not_found':
      return { status: 404, body: { error: 'simulado_not_found' } }
    case 'simulado_not_published':
      return { status: 409, body: { error: 'simulado_not_published' } }
    case 'student_not_eligible':
      return { status: 403, body: { error: 'student_not_eligible' } }
    case 'already_submitted':
      return {
        status: 409,
        body: { error: 'already_submitted', submitted_at: err.submitted_at },
      }
    case 'itens_invalidos':
      return {
        status: 500,
        body: {
          error: 'itens_invalidos',
          esperado: err.esperado,
          encontrado: err.encontrado,
        },
      }
    case 'db_error':
      // Nao vazar detalhes internos (nomes de tabela/constraint) ao cliente.
      // A mensagem completa fica no log da Edge Function para debug.
      console.error('[submit-simulado] db_error:', err.message)
      return { status: 500, body: { error: 'db_error' } }
  }
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'missing_authorization' })
    }
    const jwt = authHeader.substring('Bearer '.length).trim()

    const supabaseUrl = getRequiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const anonKey = getRequiredEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_KEY')
    const serviceKey = getRequiredEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
    )

    // Cliente anon com JWT do usuario — usado so p/ resolver auth.uid()
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
    if (userErr || !userData.user) {
      return jsonResponse(401, { error: 'invalid_jwt' })
    }

    // Resolve studentId pelo profile_id
    const { data: student, error: studentErr } = await userClient
      .from('students')
      .select('id')
      .eq('profile_id', userData.user.id)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (studentErr) {
      return jsonResponse(500, { error: 'db_error', message: studentErr.message })
    }
    if (!student) {
      return jsonResponse(403, { error: 'student_not_found' })
    }

    // Handler roda com service_role
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const payload: unknown = await request.json()
    const result: Outcome<SubmitResult, SubmitError> = await submitSimulado({
      client: serviceClient,
      studentId: student.id,
      payload,
    })

    if (!result.ok) {
      const { status, body } = errorToHttp(result.error)
      return jsonResponse(status, body)
    }
    return jsonResponse(200, result.data)
  } catch (error) {
    console.error('[submit-simulado]', error)
    return jsonResponse(500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'unknown',
    })
  }
})
