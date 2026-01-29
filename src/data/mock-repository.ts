import type {
  Aluno,
  BlocoCronograma,
  Cronograma,
} from '../types/domain'
import type { DataRepository } from './repository'
import { ALL_STUDENTS } from './mock-data/students'
import { DISCIPLINAS, DISCIPLINAS_BY_CODE } from './mock-data/subjects'
import { getHorariosPorTurma } from './mock-data/schedules'

const delay = <T>(value: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

// In-memory storage for cronogramas during session
const cronogramasStore = new Map<string, Cronograma>()
const blocosStore = new Map<string, BlocoCronograma[]>()

let idCounter = 1
const generateId = () => `mock-${idCounter++}`

export function createMockRepository(): DataRepository {
  return {
    students: {
      findByMatricula: async (matricula) => {
        const found = ALL_STUDENTS.find((s) => s.matricula === matricula)
        if (!found) return delay(null)

        const aluno: Aluno = {
          id: found.matricula,
          matricula: found.matricula,
          nome: found.nome,
          turma: found.turma,
          email: null,
          fotoFilename: `${found.matricula}.jpg`,
          createdAt: new Date(),
        }
        return delay(aluno)
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
            createdAt: new Date(),
          }))
        )
      },
    },

    schedules: {
      getOfficialSchedule: async (turma) => {
        return delay(getHorariosPorTurma(turma))
      },
    },

    cronogramas: {
      getCronograma: async (alunoId) => {
        return delay(cronogramasStore.get(alunoId) ?? null)
      },

      saveCronograma: async (data) => {
        const cronograma: Cronograma = {
          ...data,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        cronogramasStore.set(data.alunoId, cronograma)
        blocosStore.set(cronograma.id, [])
        return delay(cronograma)
      },

      updateCronograma: async (id, updates) => {
        const existing = Array.from(cronogramasStore.values()).find(
          (c) => c.id === id
        )
        if (!existing) throw new Error(`Cronograma ${id} not found`)

        const updated: Cronograma = {
          ...existing,
          ...updates,
          updatedAt: new Date(),
        }
        cronogramasStore.set(existing.alunoId, updated)
        return delay(updated)
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
        return delay(bloco)
      },

      updateBloco: async (id, updates) => {
        for (const [cronogramaId, blocos] of blocosStore.entries()) {
          const index = blocos.findIndex((b) => b.id === id)
          if (index !== -1) {
            const updated = { ...blocos[index], ...updates }
            blocos[index] = updated
            blocosStore.set(cronogramaId, [...blocos])
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
}

// Singleton instance
let repositoryInstance: DataRepository | null = null

export function getRepository(): DataRepository {
  if (!repositoryInstance) {
    repositoryInstance = createMockRepository()
  }
  return repositoryInstance
}
