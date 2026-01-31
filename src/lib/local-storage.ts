import { repositoryConfig, logRepository } from '../config/repository-config'

/**
 * LocalStorage persistence helper for mock repository
 */

const STORAGE_KEY = repositoryConfig.localStorageKey

export interface PersistedData {
  cronogramas: Array<{
    id: string
    alunoId: string
    semanaInicio: string
    semanaFim: string
    observacoes: string | null
    status: 'ativo' | 'arquivado'
    createdAt: string
    updatedAt: string
  }>
  blocos: Array<{
    id: string
    cronogramaId: string
    diaSemana: string
    horarioInicio: string
    horarioFim: string
    turno: string
    tipo: string
    titulo: string
    descricao: string | null
    disciplinaCodigo: string | null
    cor: string | null
    prioridade: number
    concluido: boolean
    createdAt: string
  }>
  version: number
}

const CURRENT_VERSION = 1

export function loadFromStorage(): PersistedData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      logRepository('Nenhum dado encontrado no localStorage')
      return null
    }

    const parsed = JSON.parse(data) as PersistedData
    
    // Verifica versão para futuras migrações
    if (parsed.version !== CURRENT_VERSION) {
      logRepository('Versão dos dados diferente, ignorando', { 
        current: parsed.version, 
        expected: CURRENT_VERSION 
      })
      return null
    }

    logRepository('Dados carregados do localStorage', {
      cronogramas: parsed.cronogramas.length,
      blocos: parsed.blocos.length,
    })

    return parsed
  } catch (error) {
    console.error('[LocalStorage] Erro ao carregar dados:', error)
    return null
  }
}

export function saveToStorage(data: PersistedData): void {
  try {
    const dataWithVersion = { ...data, version: CURRENT_VERSION }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithVersion))
    logRepository('Dados salvos no localStorage', {
      cronogramas: data.cronogramas.length,
      blocos: data.blocos.length,
    })
  } catch (error) {
    console.error('[LocalStorage] Erro ao salvar dados:', error)
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    logRepository('Dados removidos do localStorage')
  } catch (error) {
    console.error('[LocalStorage] Erro ao limpar dados:', error)
  }
}

/** Hook para detectar mudanças em outras abas */
export function subscribeToStorageChanges(
  callback: (data: PersistedData | null) => void
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      if (event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as PersistedData
          callback(data)
        } catch {
          callback(null)
        }
      } else {
        callback(null)
      }
    }
  }

  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
