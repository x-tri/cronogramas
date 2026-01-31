/**
 * Repository Factory
 * 
 * Centraliza a criação de repositories baseado na configuração.
 * 
 * Uso:
 * ```ts
 * // No main.tsx ou App.tsx
 * import { initializeRepository, RepositoryProvider } from './data/factory'
 * 
 * const repository = initializeRepository()
 * 
 * ReactDOM.createRoot(document.getElementById('root')!).render(
 *   <RepositoryProvider repository={repository}>
 *     <App />
 *   </RepositoryProvider>
 * )
 * ```
 * 
 * Nos componentes:
 * ```ts
 * const repository = useRepository()
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { DataRepository } from './repository'
import { createMockRepository } from './mock-repository'
import { createSupabaseRepository } from './supabase-repository'
import { 
  getEffectiveMode, 
  isSupabaseConfigured, 
  logRepository,
  repositoryConfig 
} from '../config/repository-config'

// Singleton instance
let repositoryInstance: DataRepository | null = null
let initializationError: Error | null = null

export interface RepositoryInitialization {
  repository: DataRepository
  mode: 'supabase' | 'mock'
  error: Error | null
}

/**
 * Inicializa o repository baseado na configuração.
 * Deve ser chamado uma vez na inicialização da aplicação.
 */
export function initializeRepository(): RepositoryInitialization {
  // Retorna instância existente
  if (repositoryInstance) {
    return {
      repository: repositoryInstance,
      mode: getEffectiveMode(),
      error: initializationError,
    }
  }

  const mode = getEffectiveMode()
  
  logRepository('Inicializando repository', { mode, config: repositoryConfig })

  try {
    if (mode === 'supabase') {
      repositoryInstance = createSupabaseRepository()
      console.log('[Repository] ✅ Modo Supabase ativo')
    } else {
      repositoryInstance = createMockRepository()
      console.log('[Repository] ⚠️ Modo Mock ativo (dados salvos localmente)')
      
      if (!isSupabaseConfigured()) {
        console.log('[Repository] 💡 Dica: Configure VITE_SUPABASE_URL e VITE_SUPABASE_KEY para usar Supabase')
      }
    }

    initializationError = null
    
    return {
      repository: repositoryInstance,
      mode,
      error: null,
    }
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error))
    
    // Em caso de erro, tenta fallback para mock
    if (mode === 'supabase') {
      console.warn('[Repository] Erro ao inicializar Supabase, fallback para Mock')
      repositoryInstance = createMockRepository()
      return {
        repository: repositoryInstance,
        mode: 'mock',
        error: initializationError,
      }
    }
    
    throw initializationError
  }
}

/**
 * Retorna a instância atual do repository.
 * Throws se initializeRepository() não foi chamado.
 */
export function getRepository(): DataRepository {
  if (!repositoryInstance) {
    throw new Error(
      'Repository not initialized. ' +
      'Call initializeRepository() before using getRepository().'
    )
  }
  return repositoryInstance
}

/**
 * Retorna informações sobre o estado atual do repository
 */
export function getRepositoryStatus(): {
  initialized: boolean
  mode: 'supabase' | 'mock' | null
  error: Error | null
} {
  return {
    initialized: repositoryInstance !== null,
    mode: repositoryInstance ? getEffectiveMode() : null,
    error: initializationError,
  }
}

/**
 * Força o uso do mock repository (útil para testes)
 */
export function forceMockRepository(): DataRepository {
  repositoryInstance = createMockRepository()
  console.log('[Repository] Mock repository forçado')
  return repositoryInstance
}

/**
 * Reseta o singleton (útil para testes)
 */
export function resetRepository(): void {
  repositoryInstance = null
  initializationError = null
  console.log('[Repository] Repository resetado')
}

// ============================================================================
// React Context
// ============================================================================

interface RepositoryContextValue {
  repository: DataRepository
  mode: 'supabase' | 'mock'
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null)

interface RepositoryProviderProps {
  repository: DataRepository
  mode?: 'supabase' | 'mock'
  children: ReactNode
}

export function RepositoryProvider({ 
  repository, 
  mode = 'mock',
  children 
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={{ repository, mode }}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useRepository(): DataRepository {
  const context = useContext(RepositoryContext)
  if (!context) {
    throw new Error(
      'useRepository must be used within a RepositoryProvider. ' +
      'Make sure you wrapped your app with <RepositoryProvider>.'
    )
  }
  return context.repository
}

export function useRepositoryMode(): 'supabase' | 'mock' {
  const context = useContext(RepositoryContext)
  if (!context) {
    throw new Error('useRepositoryMode must be used within a RepositoryProvider')
  }
  return context.mode
}
