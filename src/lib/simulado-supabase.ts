import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

type SupabaseConfig = {
  url: string
  key: string
}

let simuladoSupabaseInstance: SupabaseClient | null = null

function getPrimaryConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_KEY?.trim()

  if (!url || !key || url === 'undefined' || key === 'undefined') {
    return null
  }

  return { url, key }
}

function getDedicatedSimuladoConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SIMULADO_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SIMULADO_SUPABASE_KEY?.trim()

  if (!url || !key || url === 'undefined' || key === 'undefined') {
    return null
  }

  return { url, key }
}

export function isDedicatedSimuladoSupabaseConfigured(): boolean {
  const dedicated = getDedicatedSimuladoConfig()
  const primary = getPrimaryConfig()

  if (!dedicated) {
    return false
  }

  return (
    dedicated.url !== primary?.url ||
    dedicated.key !== primary?.key
  )
}

export function getSimuladoSupabaseClient(): SupabaseClient {
  const dedicated = getDedicatedSimuladoConfig()

  if (!dedicated || !isDedicatedSimuladoSupabaseConfigured()) {
    return getSupabaseClient()
  }

  if (!simuladoSupabaseInstance) {
    simuladoSupabaseInstance = createClient(dedicated.url, dedicated.key)
  }

  return simuladoSupabaseInstance
}

export const simuladoSupabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const client = getSimuladoSupabaseClient()
    return client[prop as keyof SupabaseClient]
  },
})

export async function syncSimuladoSupabaseSession(
  email: string,
  password: string,
): Promise<void> {
  if (!isDedicatedSimuladoSupabaseConfigured()) {
    return
  }

  const client = getSimuladoSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  const currentEmail = session?.user?.email?.toLowerCase()
  if (currentEmail && currentEmail === email.toLowerCase()) {
    return
  }

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.warn('[Simulado Auth] Falha ao sincronizar sessao:', error.message)
  }
}

export async function signOutSimuladoSupabase(): Promise<void> {
  if (!isDedicatedSimuladoSupabaseConfigured()) {
    return
  }

  await getSimuladoSupabaseClient().auth.signOut()
}
