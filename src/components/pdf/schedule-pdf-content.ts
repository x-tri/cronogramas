import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { isPlaceholderHorario, timeRangesOverlap } from '../../constants/time-slots'

type SchedulePdfContentParams = {
  officialSchedule: readonly HorarioOficial[]
  blocks: readonly BlocoCronograma[]
  dia: DiaSemana
  turno: Turno
  slot: { inicio: string; fim: string }
}

export function getSchedulePdfContent({
  officialSchedule,
  blocks,
  dia,
  turno,
  slot,
}: SchedulePdfContentParams) {
  const official = officialSchedule.find(
    (h) =>
      h.diaSemana === dia &&
      h.turno === turno &&
      !isPlaceholderHorario(h) &&
      timeRangesOverlap(slot.inicio, slot.fim, h.horarioInicio, h.horarioFim),
  )
  const block = blocks.find(
    (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio,
  )

  return { official, block }
}
