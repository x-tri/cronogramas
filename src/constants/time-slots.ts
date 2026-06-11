import type { DiaConfig, DiaSemana, TimeSlot, Turno, TurnoConfig } from '../types/domain'

/**
 * Marker que indica "slot existe na grade mas nao tem aula real" — usado
 * para placeholders de contraturno em escolas onde o coord ainda nao definiu
 * atividades (ex: Dom Bosco tarde, migration 032). Frontend renderiza slot
 * editavel; algoritmos de "ocupacao" ignoram.
 */
export const PLACEHOLDER_DISCIPLINA = '—'

export function isPlaceholderHorario(h: { disciplina: string }): boolean {
  return h.disciplina === PLACEHOLDER_DISCIPLINA
}

/**
 * Deriva os slots de horário por turno a partir da grade oficial da escola.
 *
 * Fonte ÚNICA da derivação usada pelo Kanban (cronograma-store) e pelo PDF
 * (schedule-pdf-slots) — era duplicada e as cópias divergiram no fallback,
 * causando o bug FACEX de 2026-06-11 (blocos de tarde/noite sumindo do PDF).
 *
 * Semântica: slots distintos por horário de início, ordenados; quando o
 * turno tem placeholders ('—'), só eles definem a grade (aulas reais
 * sobrepostas não criam linhas extras). Turno sem horários deriva VAZIO —
 * cada consumidor aplica seu próprio fallback explicitamente (Kanban: grade
 * default; PDF: blocos do aluno).
 */
export function deriveSlotsByTurnoFromSchedule(
  schedule: ReadonlyArray<{
    turno: Turno
    horarioInicio: string
    horarioFim: string
    disciplina: string
  }>,
): Record<Turno, TimeSlot[]> {
  const byTurno: Record<Turno, Map<string, string>> = {
    manha: new Map(),
    tarde: new Map(),
    noite: new Map(),
  }

  for (const turno of ['manha', 'tarde', 'noite'] as const) {
    const turnoSchedules = schedule.filter((h) => h.turno === turno)
    const source = turnoSchedules.some(isPlaceholderHorario)
      ? turnoSchedules.filter(isPlaceholderHorario)
      : turnoSchedules

    for (const horario of source) {
      byTurno[turno].set(horario.horarioInicio, horario.horarioFim)
    }
  }

  const toSlots = (m: Map<string, string>): TimeSlot[] =>
    [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([inicio, fim]) => ({ inicio, fim }))

  return {
    manha: toSlots(byTurno.manha),
    tarde: toSlots(byTurno.tarde),
    noite: toSlots(byTurno.noite),
  }
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(startB) < timeToMinutes(endA)
}

export const TURNOS_CONFIG: Record<Turno, TurnoConfig> = {
  manha: {
    label: 'Manhã',
    inicio: '07:15',
    fim: '13:35',
    slots: [
      { inicio: '07:15', fim: '08:05' },
      { inicio: '08:05', fim: '09:05' },
      { inicio: '09:05', fim: '09:55' },
      { inicio: '09:55', fim: '11:05' },
      { inicio: '11:05', fim: '11:55' },
      { inicio: '11:55', fim: '12:45' },
      { inicio: '12:45', fim: '13:35' },
    ],
  },
  tarde: {
    label: 'Tarde',
    inicio: '14:35',
    fim: '19:05',
    slots: [
      { inicio: '14:35', fim: '15:25' },
      { inicio: '15:25', fim: '16:15' },
      { inicio: '16:15', fim: '17:25' },
      { inicio: '17:25', fim: '18:15' },
      { inicio: '18:15', fim: '19:05' },
    ],
  },
  noite: {
    label: 'Noite',
    inicio: '19:30',
    fim: '22:30',
    slots: [
      { inicio: '19:30', fim: '20:30' },
      { inicio: '20:30', fim: '21:30' },
      { inicio: '21:30', fim: '22:30' },
    ],
  },
}

export const DIAS_CONFIG: Record<DiaSemana, DiaConfig> = {
  segunda: { temAula: true },
  terca: { temAula: true, temVespertino: true },
  quarta: { temAula: true },
  quinta: { temAula: true },
  sexta: { temAula: true },
  sabado: { temAula: false, livre: true },
  domingo: { temAula: false, livre: true },
}

export function getSlotIndex(turno: Turno, horarioInicio: string): number {
  return TURNOS_CONFIG[turno].slots.findIndex((s) => s.inicio === horarioInicio)
}

export function getSlotByIndex(turno: Turno, index: number) {
  return TURNOS_CONFIG[turno].slots[index] ?? null
}

export function getTurnoFromTime(time: string): Turno | null {
  const [hours, minutes] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes

  for (const [turno, config] of Object.entries(TURNOS_CONFIG)) {
    const [startH, startM] = config.inicio.split(':').map(Number)
    const [endH, endM] = config.fim.split(':').map(Number)
    const start = startH * 60 + startM
    const end = endH * 60 + endM

    if (totalMinutes >= start && totalMinutes < end) {
      return turno as Turno
    }
  }
  return null
}

export function formatTimeRange(inicio: string, fim: string): string {
  return `${inicio} - ${fim}`
}
