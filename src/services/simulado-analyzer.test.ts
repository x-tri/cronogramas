import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSimuladoFromProjetos,
  getSimuladoResultByHistoryItem,
  getStudentByMatricula,
  listStudentSimulados,
} from './simulado-analyzer'
import { simuladoSupabase } from '../lib/simulado-supabase'
import type {
  SimuladoHistoryItem,
  SupabaseStudent,
} from '../types/supabase'

vi.mock('../lib/simulado-supabase', () => ({
  simuladoSupabase: {
    from: vi.fn(),
  },
  isDedicatedSimuladoSupabaseConfigured: () => false,
}))

type QueryResponse = {
  data: unknown
  error: { message: string } | null
}

const queuedResponses: QueryResponse[] = []

function queueResponse(data: unknown, error: { message: string } | null = null) {
  queuedResponses.push({ data, error })
}

function createQueryBuilder(response: QueryResponse) {
  const builder = {
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (
      onFulfilled?: (value: QueryResponse) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).catch(onRejected),
    finally: (onFinally?: () => void) => Promise.resolve(response).finally(onFinally),
  }

  return builder
}

describe('Simulado Analyzer Service', () => {
  const mockStudent: SupabaseStudent = {
    id: 'student-1',
    matricula: '214140291',
    name: 'Aluno Teste',
    turma: '2A',
    sheet_code: '214140291',
    school_id: 'school-1',
    school: {
      name: 'Escola Teste',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queuedResponses.length = 0

    vi.mocked(simuladoSupabase.from).mockImplementation(() => {
      const nextResponse = queuedResponses.shift() ?? { data: null, error: null }
      const builder = createQueryBuilder(nextResponse)

      return {
        select: vi.fn(() => builder),
      } as unknown as ReturnType<typeof simuladoSupabase.from>
    })
  })

  it('retorna aluno quando encontra matrícula exata', async () => {
    queueResponse(mockStudent)

    const result = await getStudentByMatricula('214140291')

    expect(result).toEqual(mockStudent)
    expect(simuladoSupabase.from).toHaveBeenCalledWith('students')
  })

  it('tenta matrícula normalizada quando há zeros à esquerda', async () => {
    const normalizedStudent = { ...mockStudent, matricula: '12345' }

    queueResponse(null)
    queueResponse(normalizedStudent)

    const result = await getStudentByMatricula('0000012345')

    expect(result).toEqual(normalizedStudent)
    expect(simuladoSupabase.from).toHaveBeenCalledTimes(2)
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(1, 'students')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(2, 'students')
  })

  it('lista histórico consolidado a partir de student_answers + exams', async () => {
    queueResponse(null)
    queueResponse([])
    queueResponse([
      {
        id: 'answer-day-2',
        exam_id: 'exam-day-2',
        student_number: '214140291',
        student_name: 'Aluno Teste',
        turma: '2A',
        answers: ['B'],
        score: 720,
        correct_answers: 30,
        wrong_answers: 15,
        blank_answers: 0,
        tri_score: 720,
        tri_lc: 650,
        tri_ch: 700,
        tri_cn: 720,
        tri_mt: 810,
        created_at: '2024-01-16T10:00:00Z',
      },
      {
        id: 'answer-day-1',
        exam_id: 'exam-day-1',
        student_number: '214140291',
        student_name: 'Aluno Teste',
        turma: '2A',
        answers: ['B'],
        score: 710,
        correct_answers: 30,
        wrong_answers: 15,
        blank_answers: 0,
        tri_score: 710,
        tri_lc: 640,
        tri_ch: 690,
        tri_cn: 710,
        tri_mt: 800,
        created_at: '2024-01-15T10:00:00Z',
      },
    ])
    queueResponse([
      {
        id: 'exam-day-1',
        title: 'Simulado ENEM Dia 1',
        question_contents: [{ questionNumber: 1, answer: 'A', content: 'Interpretação de Texto' }],
      },
      {
        id: 'exam-day-2',
        title: 'Simulado ENEM Dia 2',
        question_contents: [{ questionNumber: 91, answer: 'C', content: 'Química' }],
      },
    ])

    const history = await listStudentSimulados('214140291')

    expect(history).toHaveLength(1)
    expect(history[0]?.title).toBe('Simulado ENEM')
    expect(history[0]?.isLatest).toBe(true)
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(1, 'students')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(2, 'projetos')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(3, 'student_answers')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(4, 'exams')
  })

  it('carrega detalhe de um item específico do histórico de student_answers', async () => {
    const item: SimuladoHistoryItem = {
      id: 'student_answers:simulado-enem:answer-day-1,answer-day-2',
      source: 'student_answers',
      title: 'Simulado ENEM',
      date: '2024-01-16T10:00:00Z',
      isLatest: true,
      answerIds: ['answer-day-1', 'answer-day-2'],
      examIds: ['exam-day-1', 'exam-day-2'],
      groupKey: 'simulado enem',
      studentNumber: '214140291',
    }

    queueResponse([
      {
        id: 'answer-day-2',
        exam_id: 'exam-day-2',
        student_number: '214140291',
        student_name: 'Aluno Teste',
        turma: '2A',
        answers: ['B'],
        score: 720,
        correct_answers: 30,
        wrong_answers: 15,
        blank_answers: 0,
        tri_score: 720,
        tri_lc: 650,
        tri_ch: 700,
        tri_cn: 720,
        tri_mt: 810,
        created_at: '2024-01-16T10:00:00Z',
      },
      {
        id: 'answer-day-1',
        exam_id: 'exam-day-1',
        student_number: '214140291',
        student_name: 'Aluno Teste',
        turma: '2A',
        answers: ['B'],
        score: 710,
        correct_answers: 30,
        wrong_answers: 15,
        blank_answers: 0,
        tri_score: 710,
        tri_lc: 640,
        tri_ch: 690,
        tri_cn: 710,
        tri_mt: 800,
        created_at: '2024-01-15T10:00:00Z',
      },
    ])
    queueResponse([
      {
        id: 'exam-day-1',
        title: 'Simulado ENEM Dia 1',
        question_contents: [{ questionNumber: 1, answer: 'A', content: 'Interpretação de Texto' }],
      },
      {
        id: 'exam-day-2',
        title: 'Simulado ENEM Dia 2',
        question_contents: [{ questionNumber: 91, answer: 'C', content: 'Química' }],
      },
    ])

    const result = await getSimuladoResultByHistoryItem(item)

    expect(result).not.toBeNull()
    expect(result?.exam.title).toBe('Simulado ENEM')
    expect(result?.wrongQuestions).toHaveLength(2)
    expect(result?.studentAnswer.tri_mt).toBe(810)
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(1, 'student_answers')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(2, 'exams')
  })

  it('retorna resultado da tabela projetos quando encontra aluno no JSONB', async () => {
    queueResponse([
      {
        id: 'projeto-1',
        nome: 'Simulado Diagnóstico',
        simulado_nome: 'Simulado Diagnóstico',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: 'merged-214140291-1234567890',
            matricula: '214140291',
            studentName: 'Aluno Teste',
            turma: '2A',
            answers: ['B'],
            areaScores: { LC: 650, CH: 700, CN: 800, MT: 750 },
          },
        ],
      },
    ])
    queueResponse({
      id: 'projeto-1',
      nome: 'Simulado Diagnóstico',
      simulado_nome: 'Simulado Diagnóstico',
      created_at: '2024-01-15T10:00:00Z',
      students: [
        {
          id: 'merged-214140291-1234567890',
          matricula: '214140291',
          studentName: 'Aluno Teste',
          turma: '2A',
          answers: ['B'],
          areaScores: { LC: 650, CH: 700, CN: 800, MT: 750 },
        },
      ],
      answer_key: ['A'],
      question_contents: [{ questionNumber: 1, content: 'Interpretação de Texto', answer: 'A' }],
    })
    queueResponse({
      id: 'projeto-1',
      nome: 'Simulado Diagnóstico',
      answer_key: ['A'],
      question_contents: [{ questionNumber: 1, content: 'Interpretação de Texto', answer: 'A' }],
    })

    const result = await getSimuladoFromProjetos('214140291')

    expect(result).not.toBeNull()
    expect(result?.exam.title).toBe('Simulado Diagnóstico')
    expect(result?.wrongQuestions).toHaveLength(1)
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(1, 'projetos')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(2, 'projetos')
    expect(simuladoSupabase.from).toHaveBeenNthCalledWith(3, 'projetos')
  })
})
