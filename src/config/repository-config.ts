/**
 * Repository Configuration
 * 
 * Define qual repository será usado pela aplicação.
 * 
 * Modos disponíveis:
 * - 'supabase': Usa Supabase (requer VITE_SUPABASE_URL e VITE_SUPABASE_KEY)
 * - 'mock': Usa dados em memória com persistência localStorage
 * - 'auto': Tenta Supabase primeiro, fallback para mock
 */

export type RepositoryMode = 'supabase' | 'mock' | 'auto'

export interface RepositoryConfig {
  mode: RepositoryMode
  /** Nome da chave no localStorage para persistência do mock */
  localStorageKey: string
  /** Log de debug no console */
  debug: boolean
}

function getConfigFromEnv(): Partial<RepositoryConfig> {
  const mode = import.meta.env.VITE_REPOSITORY_MODE as RepositoryMode | undefined
  
  return {
    mode: mode ?? 'auto',
    localStorageKey: import.meta.env.VITE_LOCAL_STORAGE_KEY ?? 'xtri-cronogramas-data',
    debug: import.meta.env.VITE_DEBUG === 'true',
  }
}

export const repositoryConfig: RepositoryConfig = {
  mode: 'auto',
  localStorageKey: 'xtri-cronogramas-data',
  debug: false,
  ...getConfigFromEnv(),
}

/** Verifica se Supabase está configurado */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return Boolean(url && key && url !== 'undefined' && key !== 'undefined')
}

/** Determina o modo efetivo baseado na configuração e disponibilidade */
export function getEffectiveMode(): 'supabase' | 'mock' {
  const { mode } = repositoryConfig
  
  if (mode === 'supabase') {
    if (!isSupabaseConfigured()) {
      console.error('[Repository] Modo Supabase solicitado mas variáveis não configuradas')
      throw new Error(
        'Repository mode is "supabase" but VITE_SUPABASE_URL or VITE_SUPABASE_KEY is missing. ' +
        'Please configure environment variables or change VITE_REPOSITORY_MODE to "mock" or "auto".'
      )
    }
    return 'supabase'
  }
  
  if (mode === 'mock') {
    return 'mock'
  }
  
  // mode === 'auto'
  return isSupabaseConfigured() ? 'supabase' : 'mock'
}

/** Log helper */
export function logRepository(message: string, data?: unknown): void {
  if (repositoryConfig.debug) {
    console.log(`[Repository] ${message}`, data ?? '')
  }
}
