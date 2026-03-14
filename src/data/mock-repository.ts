import type {
  Aluno,
  BlocoCronograma,
  Cronograma,
} from '../types/domain'
import type { DataRepository } from './repository'
import { ALL_STUDENTS } from './mock-data/students'
import { DISCIPLINAS, DISCIPLINAS_BY_CODE } from './mock-data/subjects'
import { getHorariosPorTurma } from './mock-data/schedules'
import { 
  loadFromStorage, 
  saveToStorage, 
  type PersistedData 
} from '../lib/local-storage'
import { logRepository } from '../config/repository-config'

const delay = <T>(value: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

let idCounter = 1
const generateId = () => `mock-${Date.now()}-${idCounter++}`

// In-memory storage
const cronogramasStore = new Map<string, Cronograma>()
const blocosStore = new Map<string, BlocoCronograma[]>()
let isInitialized = false

/** Inicializa o store com dados do localStorage */
function initializeStore(): void {
  if (isInitialized) return
  
  const persisted = loadFromStorage()
  if (persisted) {
    // Restaura cronogramas
    for (const c of persisted.cronogramas) {
      const cronograma: Cronograma = {
        id: c.id,
        alunoId: c.alunoId,
        semanaInicio: new Date(c.semanaInicio),
        semanaFim: new Date(c.semanaFim),
        observacoes: c.observacoes,
        status: c.status,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }
      cronogramasStore.set(c.id, cronograma)
    }

    // Restaura blocos
    for (const b of persisted.blocos) {
      const bloco: BlocoCronograma = {
        id: b.id,
        cronogramaId: b.cronogramaId,
        diaSemana: b.diaSemana as BlocoCronograma['diaSemana'],
        horarioInicio: b.horarioInicio,
        horarioFim: b.horarioFim,
        turno: b.turno as BlocoCronograma['turno'],
        tipo: b.tipo as BlocoCronograma['tipo'],
        titulo: b.titulo,
        descricao: b.descricao,
        disciplinaCodigo: b.disciplinaCodigo,
        cor: b.cor,
        prioridade: b.prioridade as BlocoCronograma['prioridade'],
        concluido: b.concluido,
        createdAt: new Date(b.createdAt),
      }
      
      const existing = blocosStore.get(b.cronogramaId) ?? []
      existing.push(bloco)
      blocosStore.set(b.cronogramaId, existing)
    }

    logRepository('Mock repository inicializado com dados persistidos', {
      cronogramas: cronogramasStore.size,
      blocos: persisted.blocos.length,
    })
  }
  
  isInitialized = true
}

/** Persiste o estado atual no localStorage */
function persistState(): void {
  const data: PersistedData = {
    cronogramas: Array.from(cronogramasStore.values()).map(c => ({
      id: c.id,
      alunoId: c.alunoId,
      semanaInicio: c.semanaInicio.toISOString(),
      semanaFim: c.semanaFim.toISOString(),
      observacoes: c.observacoes,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    blocos: Array.from(blocosStore.entries()).flatMap(([, blocos]) => 
      blocos.map(b => ({
        id: b.id,
        cronogramaId: b.cronogramaId,
        diaSemana: b.diaSemana,
        horarioInicio: b.horarioInicio,
        horarioFim: b.horarioFim,
        turno: b.turno,
        tipo: b.tipo,
        titulo: b.titulo,
        descricao: b.descricao,
        disciplinaCodigo: b.disciplinaCodigo,
        cor: b.cor,
        prioridade: b.prioridade,
        concluido: b.concluido,
        createdAt: b.createdAt.toISOString(),
      }))
    ),
    version: 1,
  }
  
  saveToStorage(data)
}

export function createMockRepository(): DataRepository {
  // Garante que o store está inicializado
  initializeStore()

  const repo: DataRepository = {
    students: {
      findByMatricula: async (matricula) => {
        // Busca nos alunos MARISTA
        const found = ALL_STUDENTS.find((s) => s.matricula === matricula)
        if (found) {
          const aluno: Aluno = {
            id: found.matricula,
            matricula: found.matricula,
            nome: found.nome,
            turma: found.turma,
            email: null,
            fotoFilename: `${found.matricula}.jpg`,
            escola: 'MARISTA',
            createdAt: new Date(),
          }
          return delay(aluno)
        }
        
        // Busca nos alunos XTRI (do localStorage)
        const alunosXTRI = JSON.parse(localStorage.getItem('xtri-alunos-xtris') || '[]')
        const foundXTRI = alunosXTRI.find((s: Aluno) => s.matricula === matricula)
        if (foundXTRI) {
          return delay({
            ...foundXTRI,
            createdAt: new Date(foundXTRI.createdAt),
          })
        }
        
        return delay(null)
      },

      findByTurma: async (turma) => {
        const students = ALL_STUDENTS.filter((s) => s.turma === turma)
        return delay(
          students.map((s) => ({
            id: s.matricula,
            matricula: s.matricula,
            nome: s.nome,
            turma: s.turma,
            email: null,
            fotoFilename: `${s.matricula}.jpg`,
            escola: 'MARISTA' as const,
            createdAt: new Date(),
          }))
        )
      },

      createAlunoXTRI: async (data) => {
        const aluno: Aluno = {
          id: generateId(),
          matricula: data.matricula,
          nome: data.nome,
          turma: data.turma,
          email: data.email,
          fotoFilename: data.fotoFilename,
          escola: 'XTRI',
          createdAt: new Date(),
        }
        
        // Mock mode: persiste no localStorage
        // Em produção (Supabase), vai para a tabela alunos_xtris
        const alunosXTRI = JSON.parse(localStorage.getItem('xtri-alunos-xtris') || '[]')
        alunosXTRI.push({
          ...aluno,
          createdAt: aluno.createdAt.toISOString(),
        })
        localStorage.setItem('xtri-alunos-xtris', JSON.stringify(alunosXTRI))
        
        logRepository('Aluno XTRI criado (mock)', { matricula: aluno.matricula, nome: aluno.nome })
        
        return delay(aluno)
      },
    },

    schedules: {
      getOfficialSchedule: async (turma) => {
        return delay(getHorariosPorTurma(turma))
      },
    },

    cronogramas: {
      getCronograma: async (alunoId, weekStart) => {
        // Procura cronograma do aluno para a semana específica
        for (const c of cronogramasStore.values()) {
          if (c.alunoId === alunoId) {
            if (!weekStart) return delay(c)
            
            const weekStartTime = weekStart.getTime()
            const cStartTime = c.semanaInicio.getTime()
            const cEndTime = c.semanaFim.getTime()
            
            if (weekStartTime >= cStartTime && weekStartTime <= cEndTime) {
              return delay(c)
            }
          }
        }
        return delay(null)
      },

      getAllCronogramas: async (alunoId) => {
        const all = Array.from(cronogramasStore.values()).filter(
          (c) => c.alunoId === alunoId
        )
        return delay(all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
      },

      saveCronograma: async (data) => {
        const cronograma: Cronograma = {
          ...data,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        cronogramasStore.set(cronograma.id, cronograma)
        blocosStore.set(cronograma.id, [])
        
        persistState()
        logRepository('Cronograma criado', { id: cronograma.id })
        
        return delay(cronograma)
      },

      updateCronograma: async (id, updates) => {
        const existing = cronogramasStore.get(id)
        if (!existing) throw new Error(`Cronograma ${id} not found`)

        const updated: Cronograma = {
          ...existing,
          ...updates,
          updatedAt: new Date(),
        }
        cronogramasStore.set(id, updated)
        
        persistState()
        logRepository('Cronograma atualizado', { id })

        return delay(updated)
      },

      deleteCronograma: async (id) => {
        cronogramasStore.delete(id)
        blocosStore.delete(id)
        persistState()
        logRepository('Cronograma deletado', { id })
        return delay(undefined)
      },
    },

    blocos: {
      getBlocos: async (cronogramaId) => {
        return delay(blocosStore.get(cronogramaId) ?? [])
      },

      createBloco: async (data) => {
        const bloco: BlocoCronograma = {
          ...data,
          id: generateId(),
          createdAt: new Date(),
        }
        const existing = blocosStore.get(data.cronogramaId) ?? []
        blocosStore.set(data.cronogramaId, [...existing, bloco])
        
        persistState()
        logRepository('Bloco criado', { id: bloco.id, cronogramaId: data.cronogramaId })
        
        return delay(bloco)
      },

      updateBloco: async (id, updates) => {
        for (const [cronogramaId, blocos] of blocosStore.entries()) {
          const index = blocos.findIndex((b) => b.id === id)
          if (index !== -1) {
            const updated = { ...blocos[index], ...updates }
            blocos[index] = updated
            blocosStore.set(cronogramaId, [...blocos])
            
            persistState()
            logRepository('Bloco atualizado', { id })
            
            return delay(updated)
          }
        }
        throw new Error(`Bloco ${id} not found`)
      },

      deleteBloco: async (id) => {
        for (const [cronogramaId, blocos] of blocosStore.entries()) {
          const index = blocos.findIndex((b) => b.id === id)
          if (index !== -1) {
            blocos.splice(index, 1)
            blocosStore.set(cronogramaId, [...blocos])
            
            persistState()
            logRepository('Bloco deletado', { id })
            
            return delay(undefined)
          }
        }
        throw new Error(`Bloco ${id} not found`)
      },
    },

    subjects: {
      getAllSubjects: async () => {
        return delay(DISCIPLINAS)
      },

      getSubjectByCode: async (codigo) => {
        return delay(DISCIPLINAS_BY_CODE.get(codigo) ?? null)
      },
    },
  }

  return repo
}

/** Limpa todos os dados do mock (útil para testes) */
export function resetMockRepository(): void {
  cronogramasStore.clear()
  blocosStore.clear()
  isInitialized = false
  logRepository('Mock repository resetado')
}

/** Retorna estatísticas do mock (útil para debug) */
export function getMockStats(): { cronogramas: number; blocos: number } {
  const blocosCount = Array.from(blocosStore.values()).reduce(
    (acc, arr) => acc + arr.length, 
    0
  )
  return {
    cronogramas: cronogramasStore.size,
    blocos: blocosCount,
  }
}
