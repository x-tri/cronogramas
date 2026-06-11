import { describe, expect, it } from 'vitest'

import type { BlocoCronograma, HorarioOficial } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { getSchedulePdfSlotsByTurno } from './schedule-pdf-slots'

function aula(inicio: string, fim: string, turno: HorarioOficial['turno']): HorarioOficial {
  return {
    id: `${turno}-${inicio}`,
    turma: '3ª SÉRIE BM',
    diaSemana: 'segunda',
    horarioInicio: inicio,
    horarioFim: fim,
    turno,
    disciplina: 'FÍSICA1',
    professor: 'PEDRO',
  }
}

function bloco(
  inicio: string,
  fim: string,
  turno: BlocoCronograma['turno'],
  dia: BlocoCronograma['diaSemana'] = 'segunda',
): BlocoCronograma {
  return {
    id: `bloco-${dia}-${inicio}`,
    cronogramaId: 'cron-1',
    diaSemana: dia,
    horarioInicio: inicio,
    horarioFim: fim,
    turno,
    tipo: 'estudo',
    titulo: 'Estudo',
    descricao: null,
    disciplinaCodigo: null,
    cor: null,
    prioridade: 0,
    concluido: false,
    createdAt: new Date('2026-06-08T00:00:00Z'),
  }
}

describe('getSchedulePdfSlotsByTurno', () => {
  it('usa defaults em todos os turnos quando a grade é vazia', () => {
    const slots = getSchedulePdfSlotsByTurno([])

    expect(slots.manha).toEqual(TURNOS_CONFIG.manha.slots)
    expect(slots.tarde).toEqual(TURNOS_CONFIG.tarde.slots)
    expect(slots.noite).toEqual(TURNOS_CONFIG.noite.slots)
  })

  // Bug FACEX 2026-06-11: grade só tem aulas de manhã -> tarde/noite saíam
  // SEM linhas no PDF e os blocos de estudo desses turnos desapareciam.
  // Turno sem aulas deriva as linhas dos blocos do aluno.
  it('turno sem aulas na grade deriva linhas dos blocos do aluno', () => {
    const facex = [aula('07:00', '07:50', 'manha')]
    const blocks = [
      bloco('15:25', '16:15', 'tarde', 'segunda'),
      bloco('15:25', '16:15', 'tarde', 'quarta'), // mesmo horário, outro dia -> 1 linha
      bloco('17:25', '18:15', 'tarde', 'segunda'),
      bloco('19:30', '20:30', 'noite', 'sexta'),
    ]

    const slots = getSchedulePdfSlotsByTurno(facex, blocks)

    expect(slots.manha).toEqual([{ inicio: '07:00', fim: '07:50' }])
    expect(slots.tarde).toEqual([
      { inicio: '15:25', fim: '16:15' },
      { inicio: '17:25', fim: '18:15' },
    ])
    expect(slots.noite).toEqual([{ inicio: '19:30', fim: '20:30' }])
  })

  it('turno sem aulas e sem blocos continua vazio (nao inventa turno)', () => {
    const slots = getSchedulePdfSlotsByTurno([aula('07:00', '07:50', 'manha')], [])

    expect(slots.tarde).toEqual([])
    expect(slots.noite).toEqual([])
  })

  it('turno com aulas na grade ignora blocos na derivação das linhas', () => {
    const schedule = [aula('14:35', '15:25', 'tarde')]
    const blocks = [bloco('16:15', '17:25', 'tarde')]

    const slots = getSchedulePdfSlotsByTurno(schedule, blocks)

    expect(slots.tarde).toEqual([{ inicio: '14:35', fim: '15:25' }])
  })
})
