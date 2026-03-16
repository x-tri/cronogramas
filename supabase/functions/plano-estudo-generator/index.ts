import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  orchestratePlanoEstudo,
  type CompletionRequest,
  type RequestCompletion,
} from '../../../src/services/plano-estudo-generator.ts'
import { parsePlanoEstudoGeneratorInput } from '../../../src/services/plano-estudo-shared.ts'

const MARITACA_API_URL = 'https://chat.maritaca.ai/api/chat/completions'
const MARITACA_MODEL = 'sabia-3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const object = payload as Record<string, unknown>
  return typeof object.error === 'string'
    ? object.error
    : typeof object.message === 'string'
      ? object.message
      : fallback
}

function createCompletionRequester(apiKey: string): RequestCompletion {
  return async (request: CompletionRequest) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs)

    try {
      const response = await fetch(MARITACA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MARITACA_MODEL,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
      })

      const text = await response.text()
      const payload = text ? JSON.parse(text) as Record<string, unknown> : {}

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, `Maritaca API error ${response.status}`))
      }

      const choices = Array.isArray(payload.choices) ? payload.choices : []
      const choice = choices[0] as Record<string, unknown> | undefined
      const message = choice?.message as Record<string, unknown> | undefined

      return {
        content: typeof message?.content === 'string' ? message.content : '',
        finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('A IA demorou demais para responder. Tente novamente em alguns instantes.')
      }

      throw error instanceof Error ? error : new Error(String(error))
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const apiKey = Deno.env.get('MARITACA_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'MARITACA_KEY não configurada' }, 500)
    }

    const rawBody = await req.text()
    const input = parsePlanoEstudoGeneratorInput(rawBody ? JSON.parse(rawBody) : {})
    const requester = createCompletionRequester(apiKey)
    const plano = await orchestratePlanoEstudo(input, requester)

    return jsonResponse(plano)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse(
      {
        error: 'Falha ao gerar plano detalhado',
        message,
      },
      500,
    )
  }
})
