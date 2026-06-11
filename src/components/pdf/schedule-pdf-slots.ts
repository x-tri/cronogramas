import type { BlocoCronograma, HorarioOficial, Turno } from '../../types/domain'
import { TURNOS_CONFIG, isPlaceholderHorario } from '../../constants/time-slots'

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

  const byTurno: Record<Turno, Map<string, string>> = {
    manha: new Map(),
    tarde: new Map(),
    noite: new Map(),
  }

  for (const turno of ['manha', 'tarde', 'noite'] as const) {
    const turnoSchedules = officialSchedule.filter((h) => h.turno === turno)
    const source = turnoSchedules.some(isPlaceholderHorario)
      ? turnoSchedules.filter(isPlaceholderHorario)
      : turnoSchedules

    for (const horario of source) {
      byTurno[turno].set(horario.horarioInicio, horario.horarioFim)
    }

    // Turno sem aulas na grade deriva as linhas dos blocos do aluno — o
    // Kanban permite criar blocos nesses turnos (fallback de slots default
    // em applySlotsOverrideFromSchedule). Sem isso, escolas com grade só de
    // manhã (ex: FACEX) saíam com tarde/noite SEM linhas no PDF e os blocos
    // desses turnos desapareciam. Sem blocos, o turno segue vazio (não
    // inventa linhas — caso Dom Bosco sem noite).
    if (byTurno[turno].size === 0) {
      for (const block of blocks) {
        if (block.turno !== turno) continue
        byTurno[turno].set(block.horarioInicio, block.horarioFim)
      }
    }
  }

  const toSlots = (m: Map<string, string>) =>
    [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim }))

  return {
    manha: toSlots(byTurno.manha),
    tarde: toSlots(byTurno.tarde),
    noite: toSlots(byTurno.noite),
  }
}
