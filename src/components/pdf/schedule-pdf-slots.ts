import type { BlocoCronograma, HorarioOficial, Turno } from '../../types/domain'
import {
  TURNOS_CONFIG,
  deriveSlotsByTurnoFromSchedule,
} from '../../constants/time-slots'

export function getSchedulePdfSlotsByTurno(
  officialSchedule: readonly HorarioOficial[],
  blocks: readonly BlocoCronograma[] = [],
): Record<Turno, ReadonlyArray<{ inicio: string; fim: string }>> {
  if (officialSchedule.length === 0) {
    return {
      manha: TURNOS_CONFIG.manha.slots,
      tarde: TURNOS_CONFIG.tarde.slots,
      noite: TURNOS_CONFIG.noite.slots,
    }
  }

  // Derivação compartilhada com o Kanban (deriveSlotsByTurnoFromSchedule).
  // Fallback próprio do PDF: turno sem aulas na grade deriva as linhas dos
  // blocos do aluno — o Kanban permite criar blocos nesses turnos (fallback
  // de grade default no store). Sem blocos, o turno segue vazio (não inventa
  // linhas — caso Dom Bosco sem noite).
  const derived = deriveSlotsByTurnoFromSchedule(officialSchedule)

  const result = {} as Record<Turno, ReadonlyArray<{ inicio: string; fim: string }>>
  for (const turno of ['manha', 'tarde', 'noite'] as const) {
    if (derived[turno].length > 0) {
      result[turno] = derived[turno]
      continue
    }
    const fromBlocks = new Map<string, string>()
    for (const block of blocks) {
      if (block.turno !== turno) continue
      fromBlocks.set(block.horarioInicio, block.horarioFim)
    }
    result[turno] = [...fromBlocks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim }))
  }
  return result
}
