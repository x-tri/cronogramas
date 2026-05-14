import type { HorarioOficial, Turno } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'

export function getSchedulePdfSlotsByTurno(
  officialSchedule: readonly HorarioOficial[],
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

  for (const horario of officialSchedule) {
    byTurno[horario.turno].set(horario.horarioInicio, horario.horarioFim)
  }

  return {
    manha: [...byTurno.manha.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim })),
    tarde: [...byTurno.tarde.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim })),
    noite: [...byTurno.noite.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim })),
  }
}
