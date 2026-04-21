/**
 * Bulk block by shift (turno) — slots & helpers.
 *
 * User story: um botão "Bloquear MANHÃ" / "Bloquear TARDE" que, com um clique,
 * marca todos os horários da semana (seg→sex) naquele turno como "Bloqueado"
 * (tipo='rotina', titulo='Bloqueado' — convenção compatível com a detecção
 * visual existente em timeline-view.tsx). Clicar de novo remove os bloqueios.
 *
 * Ranges definidos pelo coordenador:
 *  - MANHÃ: 07:15 até 12:45 (6 slots de 50min)
 *  - TARDE: 14:35 até 18:15 (4 slots de 50min)
 *
 * O slot 12:45→13:35 da manhã e o 18:15→19:05 da tarde permanecem LIVRES
 * (não são incluídos no bulk block) — intencional, seguindo spec do usuário.
 */

import type { DiaSemana } from '../../types/domain'

export type BulkShift = 'manha' | 'tarde'

export const WEEKDAYS: readonly DiaSemana[] = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
] as const

export const SHIFT_BLOCK_SLOTS: Record<BulkShift, readonly { inicio: string; fim: string }[]> = {
  manha: [
    { inicio: '07:15', fim: '08:05' },
    { inicio: '08:05', fim: '09:05' },
    { inicio: '09:05', fim: '09:55' },
    { inicio: '09:55', fim: '11:05' },
    { inicio: '11:05', fim: '11:55' },
    { inicio: '11:55', fim: '12:45' },
  ],
  tarde: [
    { inicio: '14:35', fim: '15:25' },
    { inicio: '15:25', fim: '16:15' },
    { inicio: '16:15', fim: '17:25' },
    { inicio: '17:25', fim: '18:15' },
  ],
}

export type BlockLike = {
  readonly id: string
  readonly turno: 'manha' | 'tarde' | 'noite'
  readonly diaSemana: DiaSemana
  readonly horarioInicio: string
  readonly titulo: string
}

export type ShiftStatus = 'none' | 'partial' | 'full'

/**
 * Given current blocks and a turno, compute how many target slots are already
 * blocked and the aggregate status.
 */
export function computeShiftBlockStatus(
  blocks: readonly BlockLike[],
  turno: BulkShift,
): {
  readonly blocked: number
  readonly total: number
  readonly status: ShiftStatus
} {
  const targetSlots = SHIFT_BLOCK_SLOTS[turno]
  const total = WEEKDAYS.length * targetSlots.length
  const weekdaySet = new Set<DiaSemana>(WEEKDAYS)
  const slotStarts = new Set(targetSlots.map((s) => s.inicio))

  const blocked = blocks.filter(
    (b) =>
      b.turno === turno &&
      b.titulo === 'Bloqueado' &&
      weekdaySet.has(b.diaSemana) &&
      slotStarts.has(b.horarioInicio),
  ).length

  const status: ShiftStatus = blocked === 0 ? 'none' : blocked === total ? 'full' : 'partial'
  return { blocked, total, status }
}

/**
 * Returns the set of (dia, slot) pairs that still need to be blocked to reach full status.
 */
export function missingSlotsToBlock(
  blocks: readonly BlockLike[],
  turno: BulkShift,
): ReadonlyArray<{ dia: DiaSemana; inicio: string; fim: string }> {
  const targetSlots = SHIFT_BLOCK_SLOTS[turno]
  const existing = new Set(
    blocks
      .filter((b) => b.turno === turno)
      .map((b) => `${b.diaSemana}::${b.horarioInicio}`),
  )
  const result: Array<{ dia: DiaSemana; inicio: string; fim: string }> = []
  for (const dia of WEEKDAYS) {
    for (const slot of targetSlots) {
      const key = `${dia}::${slot.inicio}`
      if (!existing.has(key)) {
        result.push({ dia, inicio: slot.inicio, fim: slot.fim })
      }
    }
  }
  return result
}

/**
 * Returns block ids that should be deleted to fully UNBLOCK a shift.
 * Only blocks with `titulo === 'Bloqueado'` are selected (preserves study blocks).
 */
export function blockIdsToUnblock(
  blocks: readonly BlockLike[],
  turno: BulkShift,
): readonly string[] {
  const targetSlots = SHIFT_BLOCK_SLOTS[turno]
  const slotStarts = new Set(targetSlots.map((s) => s.inicio))
  const weekdaySet = new Set<DiaSemana>(WEEKDAYS)
  return blocks
    .filter(
      (b) =>
        b.turno === turno &&
        b.titulo === 'Bloqueado' &&
        weekdaySet.has(b.diaSemana) &&
        slotStarts.has(b.horarioInicio),
    )
    .map((b) => b.id)
}
