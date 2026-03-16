import type { SimuladoResult } from '../types/supabase'
import {
  buildPlanoEstudoGeneratorInput,
  normalizePlanoEstudo,
  type Atividade,
  type Diagnostico,
  type PlanoEstudo,
} from './plano-estudo-shared.ts'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plano-estudo-generator`
const PLANO_REQUEST_TIMEOUT_MS = 120_000

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return response.statusText || 'Erro desconhecido'

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string }
    return payload.message ?? payload.error ?? text
  } catch {
    return text
  }
}

function buildRequestError(status: number, message: string): Error {
  if (status === 401 || status === 403) {
    return new Error('A integração da IA está sem autorização. Verifique a configuração das Edge Functions no Supabase.')
  }

  if (status === 408 || status === 504) {
    return new Error('A IA demorou demais para responder. Tente novamente em alguns instantes.')
  }

  if (status === 429) {
    return new Error('A IA está ocupada no momento. Aguarde alguns segundos e tente novamente.')
  }

  if (status === 500 || status === 502 || status === 503) {
    return new Error(message || 'Não foi possível gerar o plano detalhado agora. Tente novamente em alguns instantes.')
  }

  return new Error(message || `Erro ao gerar plano de estudos (${status})`)
}

async function requestPlano(result: SimuladoResult): Promise<PlanoEstudo> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PLANO_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify(buildPlanoEstudoGeneratorInput(result)),
    })

    if (!response.ok) {
      const message = await readErrorMessage(response)
      throw buildRequestError(response.status, message)
    }

    const payload = await response.json() as unknown
    return normalizePlanoEstudo(payload)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A IA demorou demais para responder. Tente novamente em alguns instantes.')
    }

    if (error instanceof TypeError) {
      throw new Error('Não foi possível conectar à IA no momento. Tente novamente em alguns instantes.')
    }

    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function gerarPlanoEstudo(result: SimuladoResult): Promise<PlanoEstudo> {
  return requestPlano(result)
}

export type { Atividade, Diagnostico, PlanoEstudo }
