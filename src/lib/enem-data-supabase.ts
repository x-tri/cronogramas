import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SupabaseConfig = {
  url: string
  key: string
}

let enemDataSupabaseInstance: SupabaseClient | null = null

function getDedicatedEnemDataConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_ENEM_DATA_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_ENEM_DATA_SUPABASE_KEY?.trim()

  if (!url || !key || url === 'undefined' || key === 'undefined') {
    return null
  }

  return { url, key }
}

export function isDedicatedEnemDataSupabaseConfigured(): boolean {
  return getDedicatedEnemDataConfig() !== null
}

export function getEnemDataSupabaseClient(): SupabaseClient {
  const dedicated = getDedicatedEnemDataConfig()

  if (!dedicated) {
    throw new Error(
      'ENEM data Supabase is not configured. Please set VITE_ENEM_DATA_SUPABASE_URL and VITE_ENEM_DATA_SUPABASE_KEY.',
    )
  }

  if (!enemDataSupabaseInstance) {
    enemDataSupabaseInstance = createClient(dedicated.url, dedicated.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return enemDataSupabaseInstance
}

export const enemDataSupabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const client = getEnemDataSupabaseClient()
    return client[prop as keyof SupabaseClient]
  },
})
