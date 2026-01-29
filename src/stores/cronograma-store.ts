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

type CronogramaState = {
  // Data
  currentStudent: Aluno | null
  officialSchedule: HorarioOficial[]
  cronograma: Cronograma | null
  blocks: BlocoCronograma[]

  // Loading states
  isLoadingStudent: boolean
  isLoadingSchedule: boolean
  isSaving: boolean

  // Actions
  setStudent: (student: Aluno | null) => void
  setOfficialSchedule: (schedule: HorarioOficial[]) => void
  setCronograma: (cronograma: Cronograma | null) => void
  setBlocks: (blocks: BlocoCronograma[]) => void
  setLoadingStudent: (loading: boolean) => void
  setLoadingSchedule: (loading: boolean) => void
  setSaving: (saving: boolean) => void

  addBlock: (block: BlocoCronograma) => void
  updateBlock: (id: string, updates: Partial<BlocoCronograma>) => void
  removeBlock: (id: string) => void
  moveBlock: (
    id: string,
    dia: DiaSemana,
    turno: Turno,
    slotIndex: number
  ) => void

  // Reset
  reset: () => void
}

const initialState = {
  currentStudent: null,
  officialSchedule: [],
  cronograma: null,
  blocks: [],
  isLoadingStudent: false,
  isLoadingSchedule: false,
  isSaving: false,
}

export const useCronogramaStore = create<CronogramaState>()(
  devtools(
    (set) => ({
      ...initialState,

      setStudent: (student) => set({ currentStudent: student }),
      setOfficialSchedule: (schedule) => set({ officialSchedule: schedule }),
      setCronograma: (cronograma) => set({ cronograma }),
      setBlocks: (blocks) => set({ blocks }),
      setLoadingStudent: (loading) => set({ isLoadingStudent: loading }),
      setLoadingSchedule: (loading) => set({ isLoadingSchedule: loading }),
      setSaving: (saving) => set({ isSaving: saving }),

      addBlock: (block) =>
        set((state) => ({
          blocks: [...state.blocks, block],
        })),

      updateBlock: (id, updates) =>
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),

      removeBlock: (id) =>
        set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== id),
        })),

      moveBlock: (id, dia, turno, slotIndex) =>
        set((state) => {
          const block = state.blocks.find((b) => b.id === id)
          if (!block) return state

          const targetSlot = getSlotByIndex(turno, slotIndex)
          if (!targetSlot) return state

          return {
            blocks: state.blocks.map((b) =>
              b.id === id
                ? {
                    ...b,
                    diaSemana: dia,
                    turno: turno,
                    horarioInicio: targetSlot.inicio,
                    horarioFim: targetSlot.fim,
                  }
                : b
            ),
          }
        }),

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
