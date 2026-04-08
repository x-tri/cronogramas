import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para o banco INEP/ENEM/SISU (qgqliquusdkkwnfuzdwi).
 * Contém: enem_itens, enem_habilidades, sisu_cursos, sisu_pesos,
 *          sisu_notas_corte, sisu_aprovados, inep_escolas, etc.
 *
 * Anon key pública — segura para client-side (RLS habilitado em todas as tabelas).
 */
const INEP_SUPABASE_URL = 'https://qgqliquusdkkwnfuzdwi.supabase.co'
const INEP_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFncWxpcXV1c2Rra3duZnV6ZHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTE5NDUsImV4cCI6MjA5MDI2Nzk0NX0.fgW0FJVTNghJqZW2pvdBW_hn562V37ryRrhLaaEzjMY'

let inepSupabaseInstance: SupabaseClient | null = null

const AUXILIARY_AUTH_CONFIG = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

export function isInepSupabaseConfigured(): boolean {
  return true
}

export function getInepSupabaseClient(): SupabaseClient {
  if (!inepSupabaseInstance) {
    inepSupabaseInstance = createClient(INEP_SUPABASE_URL, INEP_SUPABASE_ANON_KEY, {
      auth: AUXILIARY_AUTH_CONFIG,
    })
  }
  return inepSupabaseInstance
}
