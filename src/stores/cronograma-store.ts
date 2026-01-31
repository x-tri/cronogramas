import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  Aluno,
  BlocoCronograma,
  Cronograma,
  DiaSemana,
  HorarioOficial,
  Turno,
} from '../types/domain'
import { getSlotByIndex } from '../constants/time-slots'
import { getRepository } from '../data/factory'

type CronogramaState = {
  // Data
  currentStudent: Aluno | null
  officialSchedule: HorarioOficial[]
  cronograma: Cronograma | null
  blocks: BlocoCronograma[]
  selectedWeek: Date
  cronogramaVersions: Cronograma[]

  // Loading states
  isLoadingStudent: boolean
  isLoadingSchedule: boolean
  isLoadingVersions: boolean
  isSaving: boolean
  error: string | null

  // Actions
  setStudent: (student: Aluno | null) => void
  setOfficialSchedule: (schedule: HorarioOficial[]) => void
  setCronograma: (cronograma: Cronograma | null) => void
  setBlocks: (blocks: BlocoCronograma[]) => void
  setSelectedWeek: (date: Date) => Promise<void>
  setLoadingStudent: (loading: boolean) => void
  setLoadingSchedule: (loading: boolean) => void
  setSaving: (saving: boolean) => void

  // Async actions with persistence
  addBlock: (
    blockData: Omit<BlocoCronograma, 'id' | 'createdAt'>
  ) => Promise<BlocoCronograma>
  updateBlock: (
    id: string,
    updates: Partial<BlocoCronograma>
  ) => Promise<BlocoCronograma>
  removeBlock: (id: string) => Promise<void>
  moveBlock: (
    id: string,
    dia: DiaSemana,
    turno: Turno,
    slotIndex: number
  ) => Promise<void>

  // Cronograma management
  loadCronograma: (alunoId: string) => Promise<void>
  createCronograma: (
    alunoId: string,
    semanaInicio: Date,
    semanaFim: Date
  ) => Promise<Cronograma>

  // Version management
  loadCronogramaVersions: (alunoId: string) => Promise<void>
  selectCronogramaVersion: (cronogramaId: string) => Promise<void>

  // Reset
  reset: () => void
}

const initialState = {
  currentStudent: null,
  officialSchedule: [],
  cronograma: null,
  blocks: [],
  selectedWeek: new Date(),
  cronogramaVersions: [] as Cronograma[],
  isLoadingStudent: false,
  isLoadingSchedule: false,
  isLoadingVersions: false,
  isSaving: false,
  error: null,
}

export const useCronogramaStore = create<CronogramaState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setStudent: (student) => set({ currentStudent: student }),
      setOfficialSchedule: (schedule) => set({ officialSchedule: schedule }),
      setCronograma: (cronograma) => set({ cronograma }),
      setBlocks: (blocks) => set({ blocks }),
      setSelectedWeek: async (date) => {
        set({ selectedWeek: date })
        // Reload cronograma for the new week if student is selected
        const student = get().currentStudent
        if (student) {
          try {
            const repo = getRepository()
            const cronograma = await repo.cronogramas.getCronograma(student.id, date)
            if (cronograma) {
              const blocos = await repo.blocos.getBlocos(cronograma.id)
              set({ cronograma, blocks: blocos })
            } else {
              set({ cronograma: null, blocks: [] })
            }
          } catch (error) {
            console.error('Failed to load cronograma for week:', error)
          }
        }
      },
      setLoadingStudent: (loading) => set({ isLoadingStudent: loading }),
      setLoadingSchedule: (loading) => set({ isLoadingSchedule: loading }),
      setSaving: (saving) => set({ isSaving: saving }),

      addBlock: async (blockData) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const savedBlock = await repo.blocos.createBloco(blockData)
          set((state) => ({
            blocks: [...state.blocks, savedBlock],
            isSaving: false,
          }))
          return savedBlock
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao criar bloco'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      updateBlock: async (id, updates) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const updatedBlock = await repo.blocos.updateBloco(id, updates)
          set((state) => ({
            blocks: state.blocks.map((b) => (b.id === id ? updatedBlock : b)),
            isSaving: false,
          }))
          return updatedBlock
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao atualizar bloco'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      removeBlock: async (id) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          await repo.blocos.deleteBloco(id)
          set((state) => ({
            blocks: state.blocks.filter((b) => b.id !== id),
            isSaving: false,
          }))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao remover bloco'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      moveBlock: async (id, dia, turno, slotIndex) => {
        const block = get().blocks.find((b) => b.id === id)
        if (!block) return

        const targetSlot = getSlotByIndex(turno, slotIndex)
        if (!targetSlot) return

        const updates = {
          diaSemana: dia,
          turno: turno,
          horarioInicio: targetSlot.inicio,
          horarioFim: targetSlot.fim,
        }

        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const updatedBlock = await repo.blocos.updateBloco(id, updates)
          set((state) => ({
            blocks: state.blocks.map((b) => (b.id === id ? updatedBlock : b)),
            isSaving: false,
          }))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao mover bloco'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      loadCronograma: async (alunoId) => {
        set({ isSaving: true, isLoadingVersions: true, error: null })
        try {
          const repo = getRepository()
          const selectedWeek = get().selectedWeek

          // Load current cronograma and all versions in parallel
          const [cronograma, versions] = await Promise.all([
            repo.cronogramas.getCronograma(alunoId, selectedWeek),
            repo.cronogramas.getAllCronogramas(alunoId),
          ])

          if (cronograma) {
            const blocos = await repo.blocos.getBlocos(cronograma.id)
            set({ cronograma, blocks: blocos, cronogramaVersions: versions, isSaving: false, isLoadingVersions: false })
          } else {
            set({ cronograma: null, blocks: [], cronogramaVersions: versions, isSaving: false, isLoadingVersions: false })
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao carregar cronograma'
          set({ isSaving: false, isLoadingVersions: false, error: message })
          throw error
        }
      },

      createCronograma: async (alunoId, semanaInicio, semanaFim) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const cronograma = await repo.cronogramas.saveCronograma({
            alunoId,
            semanaInicio,
            semanaFim,
            observacoes: null,
            status: 'ativo',
          })
          // Also refresh versions list
          const versions = await repo.cronogramas.getAllCronogramas(alunoId)
          set({ cronograma, blocks: [], cronogramaVersions: versions, isSaving: false })
          return cronograma
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao criar cronograma'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      loadCronogramaVersions: async (alunoId) => {
        set({ isLoadingVersions: true, error: null })
        try {
          const repo = getRepository()
          const versions = await repo.cronogramas.getAllCronogramas(alunoId)
          set({ cronogramaVersions: versions, isLoadingVersions: false })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao carregar versões'
          set({ isLoadingVersions: false, error: message })
          throw error
        }
      },

      selectCronogramaVersion: async (cronogramaId) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const version = get().cronogramaVersions.find((c) => c.id === cronogramaId)
          if (!version) {
            throw new Error('Versão não encontrada')
          }
          const blocos = await repo.blocos.getBlocos(cronogramaId)
          set({ cronograma: version, blocks: blocos, isSaving: false })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao selecionar versão'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      reset: () => set(initialState),
    }),
    { name: 'cronograma-store' }
  )
)

// Selectors
export const selectCurrentStudent = (state: CronogramaState) =>
  state.currentStudent
export const selectBlocks = (state: CronogramaState) => state.blocks
export const selectOfficialSchedule = (state: CronogramaState) =>
  state.officialSchedule

export function selectBlocksForCell(
  state: CronogramaState,
  dia: DiaSemana,
  turno: Turno
): BlocoCronograma[] {
  return state.blocks.filter((b) => b.diaSemana === dia && b.turno === turno)
}

export function selectOfficialForCell(
  state: CronogramaState,
  dia: DiaSemana,
  turno: Turno
): HorarioOficial[] {
  return state.officialSchedule.filter(
    (h) => h.diaSemana === dia && h.turno === turno
  )
}

export function isSlotOccupiedByOfficial(
  state: CronogramaState,
  dia: DiaSemana,
  turno: Turno,
  slotIndex: number
): boolean {
  const slot = getSlotByIndex(turno, slotIndex)
  if (!slot) return false

  return state.officialSchedule.some(
    (h) =>
      h.diaSemana === dia &&
      h.turno === turno &&
      h.horarioInicio === slot.inicio
  )
}
