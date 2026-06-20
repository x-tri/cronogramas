import { describe, expect, it } from 'vitest'

import { buildAtendimentos, buildMentorByStudent } from './school-detail'

describe('buildAtendimentos', () => {
  const students = [
    { id: 'uuid-001', matricula: '001', name: 'Ana', turma: 'Turma 300' },
    { id: 'uuid-002', matricula: '002', name: 'Bia', turma: 'Turma 301' },
    { id: 'uuid-003', matricula: '003', name: 'Caio', turma: 'Turma 300' },
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
      [{ id: 'uuid-009', matricula: '009', name: null, turma: null }],
      [{ aluno_id: '009', updated_at: '2026-06-12T08:00:00Z' }],
    )

    expect(atendimentos[0]).toMatchObject({ nome: '009', turma: '-' })
  })

  it('também reconhece cronogramas vinculados pelo UUID do aluno', () => {
    const atendimentos = buildAtendimentos(students, [
      { aluno_id: 'uuid-002', updated_at: '2026-06-13T08:00:00Z' },
    ])

    expect(atendimentos).toHaveLength(1)
    expect(atendimentos[0]).toMatchObject({
      matricula: '002',
      nome: 'Bia',
      ultimoCronograma: '2026-06-13T08:00:00Z',
    })
  })

  it('inclui mentor real quando existe autoria vinculada ao aluno', () => {
    const mentorByStudent = buildMentorByStudent(
      [
        {
          studentKey: '001',
          mentorUserId: 'mentor-antigo',
          createdAt: '2026-06-01T08:00:00Z',
        },
        {
          studentKey: '001',
          mentorUserId: 'mentor-recente',
          createdAt: '2026-06-15T08:00:00Z',
        },
        {
          studentKey: 'uuid-003',
          mentorUserId: 'mentor-email',
          createdAt: '2026-06-14T08:00:00Z',
        },
      ],
      [
        { auth_uid: 'mentor-antigo', name: 'Mentora Antiga', email: 'antiga@xtri.com' },
        { auth_uid: 'mentor-recente', name: 'Mentora Recente', email: 'recente@xtri.com' },
        { auth_uid: 'mentor-email', name: null, email: 'mentor.sem.nome@xtri.com' },
      ],
    )

    const atendimentos = buildAtendimentos(
      students,
      [
        { aluno_id: '001', updated_at: '2026-06-10T10:00:00Z' },
        { aluno_id: 'uuid-003', updated_at: '2026-06-12T08:00:00Z' },
      ],
      mentorByStudent,
    )

    expect(atendimentos.find((a) => a.matricula === '001')?.mentorNome).toBe(
      'Mentora Recente',
    )
    expect(atendimentos.find((a) => a.matricula === '003')?.mentorNome).toBe(
      'mentor.sem.nome',
    )
  })

  it('aceita nome de mentor vindo de auditoria quando não há usuário para join', () => {
    const mentorByStudent = buildMentorByStudent(
      [
        {
          studentKey: '002',
          mentorUserId: null,
          mentorNome: 'Mentora por Audit Log',
          createdAt: '2026-06-16T08:00:00Z',
        },
      ],
      [],
    )

    const atendimentos = buildAtendimentos(
      students,
      [{ aluno_id: '002', updated_at: '2026-06-16T09:00:00Z' }],
      mentorByStudent,
    )

    expect(atendimentos[0].mentorNome).toBe('Mentora por Audit Log')
  })

  it('sem cronogramas retorna vazio', () => {
    expect(buildAtendimentos(students, [])).toEqual([])
  })
})
