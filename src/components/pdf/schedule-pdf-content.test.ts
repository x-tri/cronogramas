import { describe, expect, it } from 'vitest'
import type { BlocoCronograma, HorarioOficial } from '../../types/domain'
import { getSchedulePdfContent } from './schedule-pdf-content'

describe('getSchedulePdfContent', () => {
  it('mostra bloco de estudo no PDF quando o horario oficial e placeholder', () => {
    const officialSchedule: HorarioOficial[] = [
      {
        id: 'placeholder-1',
        turma: 'Turma 301',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '14:30',
        horarioFim: '15:20',
        disciplina: '—',
        professor: null,
      },
    ]
    const blocks: BlocoCronograma[] = [
      {
        id: 'block-1',
        cronogramaId: 'cronograma-1',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '14:30',
        horarioFim: '15:20',
        tipo: 'revisao',
        titulo: 'Questão 58',
        descricao: 'Questão 58 - Revisão de erro',
        disciplinaCodigo: null,
        cor: null,
        prioridade: 1,
        concluido: false,
        createdAt: new Date(),
      },
    ]

    const content = getSchedulePdfContent({
      officialSchedule,
      blocks,
      dia: 'segunda',
      turno: 'tarde',
      slot: { inicio: '14:30', fim: '15:20' },
    })

    expect(content.official).toBeUndefined()
    expect(content.block?.titulo).toBe('Questão 58')
  })

  it('prioriza aula real quando ela sobrepoe o slot do PDF', () => {
    const officialSchedule: HorarioOficial[] = [
      {
        id: 'official-1',
        turma: 'Turma 301',
        diaSemana: 'quarta',
        turno: 'tarde',
        horarioInicio: '17:15',
        horarioFim: '18:00',
        disciplina: 'EDUCAÇÃO FÍSICA',
        professor: 'BÁRBARA',
      },
    ]

    const content = getSchedulePdfContent({
      officialSchedule,
      blocks: [],
      dia: 'quarta',
      turno: 'tarde',
      slot: { inicio: '17:30', fim: '18:20' },
    })

    expect(content.official?.disciplina).toBe('EDUCAÇÃO FÍSICA')
  })
})
