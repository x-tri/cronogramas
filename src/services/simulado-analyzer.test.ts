import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLatestSimuladoResult,
  getSimuladoFromProjetos,
  getStudentByMatricula,
} from './simulado-analyzer'
import { supabase } from '../lib/supabase'
import type { SupabaseStudent } from '../types/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
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
    then: (onFulfilled?: (value: QueryResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
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

    vi.mocked(supabase.from).mockImplementation(() => {
      const nextResponse = queuedResponses.shift() ?? { data: null, error: null }
      const builder = createQueryBuilder(nextResponse)

      return {
        select: vi.fn(() => builder),
      } as unknown as ReturnType<typeof supabase.from>
    })
  })

  it('retorna aluno quando encontra matrícula exata', async () => {
    queueResponse(mockStudent)

    const result = await getStudentByMatricula('214140291')

    expect(result).toEqual(mockStudent)
    expect(supabase.from).toHaveBeenCalledWith('students')
  })

  it('tenta matrícula normalizada quando há zeros à esquerda', async () => {
    const normalizedStudent = { ...mockStudent, matricula: '12345' }

    queueResponse(null)
    queueResponse(normalizedStudent)

    const result = await getStudentByMatricula('0000012345')

    expect(result).toEqual(normalizedStudent)
    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'students')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'students')
  })

  it('monta resultado do simulado a partir de student_answers + exams', async () => {
    queueResponse([
      {
        id: 'answer-1',
        exam_id: 'exam-1',
        student_number: '214140291',
        student_name: 'Aluno Teste',
        turma: '2A',
        answers: ['B'],
        score: 700,
        correct_answers: 0,
        wrong_answers: 1,
        blank_answers: 0,
        tri_score: null,
        tri_lc: null,
        tri_ch: null,
        tri_cn: null,
        tri_mt: null,
        created_at: '2024-01-15T10:00:00Z',
      },
    ])
    queueResponse([
      {
        id: 'exam-1',
        title: 'Simulado ENEM',
        question_contents: [{ questionNumber: 1, answer: 'A', content: 'Interpretação de Texto' }],
      },
    ])

    const result = await getLatestSimuladoResult('214140291')

    expect(result).not.toBeNull()
    expect(result?.wrongQuestions).toHaveLength(1)
    expect(result?.topicsSummary).toHaveLength(1)
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'student_answers')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'exams')
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
      answer_key: ['A'],
      question_contents: [{ questionNumber: 1, content: 'Interpretação de Texto', answer: 'A' }],
    })

    const result = await getSimuladoFromProjetos('214140291')

    expect(result).not.toBeNull()
    expect(result?.exam.title).toBe('Simulado Diagnóstico')
    expect(result?.wrongQuestions).toHaveLength(1)
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'projetos')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'projetos')
  })

  it('retorna null quando nenhum projeto contém o aluno', async () => {
    queueResponse([
      {
        id: 'projeto-1',
        nome: 'Simulado Diagnóstico',
        students: [],
        created_at: '2024-01-15T10:00:00Z',
      },
    ])

    const result = await getSimuladoFromProjetos('999999999')

    expect(result).toBeNull()
  })
})
