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
import type {
  SimuladoHistoryItem,
  SimuladoResult,
} from '../types/supabase'
import { getSlotByIndex, TURNOS_CONFIG } from '../constants/time-slots'
import { getRepository } from '../data/factory'

/**
 * Override de slots quando a escola tem grade horaria diferente da default
 * (ex: Dom Bosco com 07:20 em vez de Marista 07:15). Derivado dinamicamente
 * do `officialSchedule` carregado em student-search.tsx. Quando null,
 * componentes usam TURNOS_CONFIG[turno].slots (default Marista).
 */
export type TimeSlotsByTurno = Readonly<Record<Turno, ReadonlyArray<{ inicio: string; fim: string }>>>

type CronogramaState = {
  // Data
  currentStudent: Aluno | null
  officialSchedule: HorarioOficial[]
  /**
   * Quando definido, sobrescreve `TURNOS_CONFIG[turno].slots` da grade
   * Kanban/Timeline. Populado a partir do officialSchedule quando este
   * tem horarios distintos do default Marista (ex: Dom Bosco). Quando
   * null, consumidores caem no TURNOS_CONFIG (Marista).
   */
  slotsOverride: TimeSlotsByTurno | null
  cronograma: Cronograma | null
  blocks: BlocoCronograma[]
  selectedWeek: Date
  cronogramaVersions: Cronograma[]
  simuladoHistory: SimuladoHistoryItem[]
  selectedSimuladoHistoryItem: SimuladoHistoryItem | null
  selectedSimuladoResult: SimuladoResult | null

  // Loading states
  isLoadingStudent: boolean
  isLoadingSchedule: boolean
  isLoadingVersions: boolean
  isSaving: boolean
  error: string | null

  // Actions
  setStudent: (student: Aluno | null) => void
  setOfficialSchedule: (schedule: HorarioOficial[]) => void
  /** Define override manualmente (uso em testes / casos especiais). */
  setSlotsOverride: (override: TimeSlotsByTurno | null) => void
  /**
   * Deriva slots distintos do `schedule` (manha/tarde/noite separados),
   * compara com TURNOS_CONFIG default e:
   *   - se DIFERENTES (ou contagem distinta): popula slotsOverride
   *   - se identicos ou schedule vazio: zera slotsOverride
   */
  applySlotsOverrideFromSchedule: (schedule: HorarioOficial[]) => void
  setCronograma: (cronograma: Cronograma | null) => void
  setBlocks: (blocks: BlocoCronograma[]) => void
  setSimuladoHistory: (history: SimuladoHistoryItem[]) => void
  setSelectedSimuladoHistoryItem: (item: SimuladoHistoryItem | null) => void
  setSelectedSimuladoResult: (result: SimuladoResult | null) => void
  resetSimuladoState: () => void
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
  swapBlocks: (blockId1: string, blockId2: string) => Promise<void>
  pushBlocks: (blockId: string, dia: DiaSemana, turno: Turno, slotIndex: number) => Promise<void>

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
  deleteCronogramaVersion: (cronogramaId: string) => Promise<void>

  // Reset
  reset: () => void

  // Clear all blocks for current cronograma
  clearAllBlocks: () => Promise<void>
}

const initialState = {
  currentStudent: null,
  officialSchedule: [],
  slotsOverride: null as TimeSlotsByTurno | null,
  cronograma: null,
  blocks: [],
  selectedWeek: new Date(),
  cronogramaVersions: [] as Cronograma[],
  simuladoHistory: [] as SimuladoHistoryItem[],
  selectedSimuladoHistoryItem: null as SimuladoHistoryItem | null,
  selectedSimuladoResult: null as SimuladoResult | null,
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

      setStudent: (student) =>
        set({
          currentStudent: student,
          simuladoHistory: [],
          selectedSimuladoHistoryItem: null,
          selectedSimuladoResult: null,
        }),
      setOfficialSchedule: (schedule) => set({ officialSchedule: schedule }),

      setSlotsOverride: (override) => set({ slotsOverride: override }),

      applySlotsOverrideFromSchedule: (schedule) => {
        if (!schedule || schedule.length === 0) {
          set({ slotsOverride: null })
          return
        }
        // Deriva slots distintos por turno, ordenados por horario_inicio.
        const byTurno: Record<Turno, Map<string, string>> = {
          manha: new Map(),
          tarde: new Map(),
          noite: new Map(),
        }
        for (const h of schedule) {
          byTurno[h.turno].set(h.horarioInicio, h.horarioFim)
        }
        const toSlots = (m: Map<string, string>) =>
          [...m.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([inicio, fim]) => ({ inicio, fim }))
        const derived: TimeSlotsByTurno = {
          manha: toSlots(byTurno.manha),
          tarde: toSlots(byTurno.tarde),
          noite: toSlots(byTurno.noite),
        }
        // Se identico ao default Marista em todos os turnos, nao precisa
        // override (evita recalculo inutil downstream).
        const identical = (['manha', 'tarde', 'noite'] as const).every((t) => {
          const def = TURNOS_CONFIG[t].slots
          const got = derived[t]
          if (def.length !== got.length) return got.length === 0
          return def.every((s, i) => s.inicio === got[i]?.inicio && s.fim === got[i]?.fim)
        })
        if (identical) {
          set({ slotsOverride: null })
          return
        }
        // Para turnos sem horarios no schedule (ex: noite vazio em Dom Bosco),
        // mantem o default em vez de array vazio (UI continua mostrando grade
        // do TURNOS_CONFIG nesse turno).
        const merged: TimeSlotsByTurno = {
          manha: derived.manha.length > 0 ? derived.manha : TURNOS_CONFIG.manha.slots,
          tarde: derived.tarde.length > 0 ? derived.tarde : TURNOS_CONFIG.tarde.slots,
          noite: derived.noite.length > 0 ? derived.noite : TURNOS_CONFIG.noite.slots,
        }
        set({ slotsOverride: merged })
      },
      setCronograma: (cronograma) => set({ cronograma }),
      setBlocks: (blocks) => set({ blocks }),
      setSimuladoHistory: (history) => set({ simuladoHistory: history }),
      setSelectedSimuladoHistoryItem: (item) =>
        set({ selectedSimuladoHistoryItem: item }),
      setSelectedSimuladoResult: (result) => set({ selectedSimuladoResult: result }),
      resetSimuladoState: () =>
        set({
          simuladoHistory: [],
          selectedSimuladoHistoryItem: null,
          selectedSimuladoResult: null,
        }),
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

      swapBlocks: async (blockId1, blockId2) => {
        const block1 = get().blocks.find((b) => b.id === blockId1)
        const block2 = get().blocks.find((b) => b.id === blockId2)
        if (!block1 || !block2) return

        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          
          // Swap the positions
          const updates1 = {
            diaSemana: block2.diaSemana,
            turno: block2.turno,
            horarioInicio: block2.horarioInicio,
            horarioFim: block2.horarioFim,
          }
          const updates2 = {
            diaSemana: block1.diaSemana,
            turno: block1.turno,
            horarioInicio: block1.horarioInicio,
            horarioFim: block1.horarioFim,
          }

          const [updatedBlock1, updatedBlock2] = await Promise.all([
            repo.blocos.updateBloco(blockId1, updates1),
            repo.blocos.updateBloco(blockId2, updates2),
          ])

          set((state) => ({
            blocks: state.blocks.map((b) => {
              if (b.id === blockId1) return updatedBlock1
              if (b.id === blockId2) return updatedBlock2
              return b
            }),
            isSaving: false,
          }))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao trocar blocos'
          set({ isSaving: false, error: message })
          throw error
        }
      },

      pushBlocks: async (blockId, dia, turno, slotIndex) => {
        // This is a placeholder for future implementation of cascading push
        // For now, it just moves the block normally
        await get().moveBlock(blockId, dia, turno, slotIndex)
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

      deleteCronogramaVersion: async (cronogramaId) => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          await repo.cronogramas.deleteCronograma(cronogramaId)

          const state = get()
          // Se era o cronograma ativo, limpa o estado
          const wasActive = state.cronograma?.id === cronogramaId
          set((s) => ({
            cronogramaVersions: s.cronogramaVersions.filter((v) => v.id !== cronogramaId),
            cronograma: wasActive ? null : s.cronograma,
            blocks: wasActive ? [] : s.blocks,
            isSaving: false,
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro ao deletar cronograma'
          set({ isSaving: false, error: message })
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

      clearAllBlocks: async () => {
        set({ isSaving: true, error: null })
        try {
          const repo = getRepository()
          const { blocks, cronograma } = get()
          
          // Delete all blocks from database
          await Promise.all(
            blocks.map((block) => repo.blocos.deleteBloco(block.id))
          )
          
          // Clear blocks from state
          set({ blocks: [], isSaving: false })
          
          console.log(`[CronogramaStore] Cleared ${blocks.length} blocks from cronograma ${cronograma?.id}`)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erro ao limpar cronograma'
          set({ isSaving: false, error: message })
          throw error
        }
      },
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
