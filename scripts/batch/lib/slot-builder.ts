/**
 * Construção dos slots disponíveis para a semana de estudos do batch INTEGRADO.
 *
 * Constraint do produto (definido pelo coordenador):
 *   - Seg-Sex: BLOQUEAR manhã. Apenas tarde + noite.
 *   - Sáb-Dom: livre — manhã + tarde + noite (sem aula oficial).
 */

import { TURNOS_CONFIG } from '../../../src/constants/time-slots'
import type { DiaSemana, Turno } from '../../../src/types/domain'
import { DIAS_SEMANA } from '../../../src/types/domain'

export interface SlotRef {
  readonly diaSemana: DiaSemana
  readonly turno: Turno
  readonly horarioInicio: string
  readonly horarioFim: string
}

export interface SlotBuilderOptions {
  /** Se true, slots de 'manha' em dias de semana (seg-sex) são excluídos. Default true. */
  readonly blockWeekdayMorning?: boolean
}

/**
 * Retorna lista ordenada (seg→dom; manha→tarde→noite) de slots disponíveis
 * para a semana, aplicando a constraint de bloquear manhã em dias úteis.
 */
export function buildSchedulableSlots(opts: SlotBuilderOptions = {}): SlotRef[] {
  const blockWeekdayMorning = opts.blockWeekdayMorning ?? true
  const slots: SlotRef[] = []

  for (const dia of DIAS_SEMANA) {
    const isWeekend = dia === 'sabado' || dia === 'domingo'

    const turnosForDay: Turno[] = isWeekend
      ? ['manha', 'tarde', 'noite']
      : blockWeekdayMorning
        ? ['tarde', 'noite']
        : ['manha', 'tarde', 'noite']

    for (const turno of turnosForDay) {
      const cfg = TURNOS_CONFIG[turno]
      for (const slot of cfg.slots) {
        slots.push({
          diaSemana: dia,
          turno,
          horarioInicio: slot.inicio,
          horarioFim: slot.fim,
        })
      }
    }
  }

  return slots
}

/**
 * Métrica útil para verificar capacidade antes de distribuir.
 */
export function summarizeSlots(slots: readonly SlotRef[]): {
  total: number
  byDia: Record<DiaSemana, number>
  byTurno: Record<Turno, number>
} {
  const byDia = {} as Record<DiaSemana, number>
  const byTurno = {} as Record<Turno, number>
  for (const dia of DIAS_SEMANA) byDia[dia] = 0
  for (const turno of ['manha', 'tarde', 'noite'] as const) byTurno[turno] = 0

  for (const s of slots) {
    byDia[s.diaSemana]++
    byTurno[s.turno]++
  }

  return { total: slots.length, byDia, byTurno }
}
