import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../config/repository-config'

let supabaseInstance: SupabaseClient | null = null

/**
 * Retorna o cliente Supabase inicializado.
 * Lança erro se Supabase não estiver configurado.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_KEY environment variables.'
    )
  }
  
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_KEY
    supabaseInstance = createClient(url, key)
  }
  
  return supabaseInstance
}

/**
 * Cliente Supabase para uso direto.
 * ⚠️ Só use se tiver certeza que Supabase está configurado.
 * Em caso de dúvida, use getSupabaseClient() com try/catch.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const client = getSupabaseClient()
    return client[prop as keyof SupabaseClient]
  },
})
