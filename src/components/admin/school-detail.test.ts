import { describe, expect, it } from 'vitest'

import { buildAtendimentos } from './school-detail'

describe('buildAtendimentos', () => {
  const students = [
    { matricula: '001', name: 'Ana', turma: 'Turma 300' },
    { matricula: '002', name: 'Bia', turma: 'Turma 301' },
    { matricula: '003', name: 'Caio', turma: 'Turma 300' },
  ]

  it('só inclui alunos com cronograma, com a data do mais recente', () => {
    const atendimentos = buildAtendimentos(students, [
      { aluno_id: '001', updated_at: '2026-06-01T10:00:00Z' },
      { aluno_id: '001', updated_at: '2026-06-10T10:00:00Z' },
      { aluno_id: '003', updated_at: '2026-06-12T08:00:00Z' },
    ])

    expect(atendimentos.map((a) => a.matricula)).toEqual(['003', '001'])
    expect(atendimentos[1].ultimoCronograma).toBe('2026-06-10T10:00:00Z')
    // 002 (Bia) sem cronograma fica de fora
  })

  it('aluno sem nome cai na matrícula; sem turma vira "-"', () => {
    const atendimentos = buildAtendimentos(
      [{ matricula: '009', name: null, turma: null }],
      [{ aluno_id: '009', updated_at: '2026-06-12T08:00:00Z' }],
    )

    expect(atendimentos[0]).toMatchObject({ nome: '009', turma: '-' })
  })

  it('sem cronogramas retorna vazio', () => {
    expect(buildAtendimentos(students, [])).toEqual([])
  })
})
