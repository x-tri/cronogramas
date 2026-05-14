import { describe, expect, it } from 'vitest'
import type { HorarioOficial } from '../../types/domain'
import { getSchedulePdfSlotsByTurno } from './schedule-pdf-document'

describe('getSchedulePdfSlotsByTurno', () => {
  it('usa a grade real da escola e nao inventa turno sem horario', () => {
    const schedule: HorarioOficial[] = [
      {
        id: 'db-1',
        turma: 'Turma 300',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:45',
        disciplina: '—',
        professor: null,
      },
      {
        id: 'db-2',
        turma: 'Turma 300',
        diaSemana: 'terca',
        turno: 'tarde',
        horarioInicio: '15:45',
        horarioFim: '16:30',
        disciplina: '—',
        professor: null,
      },
      {
        id: 'db-3',
        turma: 'Turma 300',
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:20',
        horarioFim: '08:05',
        disciplina: 'MAT',
        professor: null,
      },
    ]

    const slots = getSchedulePdfSlotsByTurno(schedule)

    expect(slots.manha).toEqual([{ inicio: '07:20', fim: '08:05' }])
    expect(slots.tarde).toEqual([
      { inicio: '15:00', fim: '15:45' },
      { inicio: '15:45', fim: '16:30' },
    ])
    expect(slots.noite).toEqual([])
  })
})
