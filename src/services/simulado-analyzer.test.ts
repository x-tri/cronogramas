import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  analyzeStudentSimulado,
  getStudentByMatricula,
  getLatestSimuladoResult,
  getSimuladoFromProjetos,
  diagnoseStudentAnswers,
} from './simulado-analyzer'
import { supabase } from '../lib/supabase'
import type { SimuladoResult, SupabaseStudent, ProjetoRow } from '../types/supabase'

// Mock do supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('Simulado Analyzer', () => {
  const mockMatricula = '214140291'
  const mockSheetCode = '214140291'
  
  // Mock data
  const mockStudent: SupabaseStudent = {
    id: 'student-123',
    matricula: mockMatricula,
    name: 'Aluno Teste',
    turma: '2A',
    sheet_code: mockSheetCode,
    school_id: 'school-1',
    school: {
      name: 'Escola Teste',
    }
  }

  const mockStudentAnswer = {
    id: 'answer-123',
    exam_id: 'exam-123',
    student_number: mockSheetCode,
    student_name: 'Aluno Teste',
    turma: '2A',
    answers: ['A', 'B', 'C', 'D', 'E'],
    score: 750,
    correct_answers: 120,
    wrong_answers: 45,
    blank_answers: 15,
    tri_score: 750,
    tri_lc: 650,
    tri_ch: 700,
    tri_cn: 800,
    tri_mt: 750,
    created_at: '2024-01-15T10:00:00Z',
  }

  const mockExam = {
    id: 'exam-123',
    title: 'Simulado ENEM 2024',
    answer_key: ['A', 'B', 'C', 'D', 'E'],
    question_contents: [
      { questionNumber: 1, answer: 'A', content: 'Interpretação de Texto' },
      { questionNumber: 2, answer: 'B', content: 'Gramática' },
      { questionNumber: 3, answer: 'C', content: 'Matemática Básica' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getStudentByMatricula', () => {
    it('deve retornar o aluno quando encontrado com matrícula exata', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: mockStudent,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getStudentByMatricula(mockMatricula)

      expect(result).toEqual(mockStudent)
      expect(supabase.from).toHaveBeenCalledWith('students')
      expect(mockEq).toHaveBeenCalledWith('matricula', mockMatricula)
    })

    it('deve retornar null quando aluno não encontrado', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getStudentByMatricula('999999999')

      expect(result).toBeNull()
    })

    it('deve tentar matrícula normalizada quando não encontra com zeros', async () => {
      const mockStudentNoZeros = { ...mockStudent, matricula: '12345' }
      
      const mockMaybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // Primeira tentativa
        .mockResolvedValueOnce({ data: mockStudentNoZeros, error: null }) // Segunda tentativa
      
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getStudentByMatricula('0000012345')

      expect(result).toEqual(mockStudentNoZeros)
      expect(mockEq).toHaveBeenNthCalledWith(1, 'matricula', '0000012345')
      expect(mockEq).toHaveBeenNthCalledWith(2, 'matricula', '12345')
    })

    it('deve lidar com erro do supabase', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      })
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getStudentByMatricula(mockMatricula)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('getLatestSimuladoResult', () => {
    it('deve retornar resultado do simulado com questões erradas', async () => {
      // Mock student_answers
      const mockOrder = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [mockStudentAnswer],
          error: null,
        }),
      })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      // Mock exams
      const mockIn = vi.fn().mockReturnValue({
        data: [mockExam],
        error: null,
      })
      const mockSelectExams = vi.fn().mockReturnValue({ in: mockIn })

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>)
        .mockReturnValueOnce({ select: mockSelectExams } as unknown as ReturnType<typeof supabase.from>)

      const result = await getLatestSimuladoResult(mockSheetCode)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.exam.id).toBe(mockExam.id)
        expect(result.studentAnswer.student_number).toBe(mockSheetCode)
        expect(Array.isArray(result.wrongQuestions)).toBe(true)
        expect(Array.isArray(result.topicsSummary)).toBe(true)
      }
    })

    it('deve retornar null quando não há respostas do aluno', async () => {
      const mockOrder = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getLatestSimuladoResult(mockSheetCode)

      expect(result).toBeNull()
    })

    it('deve tentar busca normalizada quando não encontra com formato original', async () => {
      const normalizedCode = '12345'
      
      const mockOrder = vi.fn()
        .mockReturnValueOnce({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })
        .mockReturnValueOnce({
          limit: vi.fn().mockResolvedValue({
            data: [mockStudentAnswer],
            error: null,
          }),
        })
      
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      await getLatestSimuladoResult('0000012345')

      expect(mockEq).toHaveBeenNthCalledWith(1, 'student_number', '0000012345')
      expect(mockEq).toHaveBeenNthCalledWith(2, 'student_number', normalizedCode)
    })
  })

  describe('getSimuladoFromProjetos', () => {
    it('deve retornar resultado quando aluno encontrado em projeto', async () => {
      const mockProjeto = {
        id: 'projeto-123',
        nome: 'Simulado Marista',
        simulado_nome: 'Simulado Diagnóstico',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: `merged-${mockMatricula}-1234567890`,
            matricula: mockMatricula,
            studentName: 'Aluno Teste',
            turma: '2A',
            answers: ['A', 'B', 'C'],
            score: 750,
            areaCorrectAnswers: { LC: 40, CH: 38, CN: 42, MT: 35 },
            areaScores: { LC: 650, CH: 700, CN: 800, MT: 750 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.exam.title).toBe('Simulado Diagnóstico')
        expect(result.studentAnswer.student_number).toBe(mockMatricula)
        expect(result.studentAnswer.student_name).toBe('Aluno Teste')
        expect(Array.isArray(result.wrongQuestions)).toBe(true)
        expect(Array.isArray(result.topicsSummary)).toBe(true)
      }
    })

    it('deve retornar null quando nenhum projeto contém o aluno', async () => {
      const mockProjeto = {
        id: 'projeto-123',
        nome: 'Simulado Marista',
        students: [],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).toBeNull()
    })

    it('deve lidar com erro ao buscar projetos', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockOrder = vi.fn().mockReturnValue({
        data: null,
        error: { message: 'Database error' },
      })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).toBeNull()
      
      consoleSpy.mockRestore()
    })

    it('deve encontrar aluno por student_number quando matrícula diferente', async () => {
      const mockProjeto = {
        id: 'projeto-123',
        nome: 'Simulado Marista',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: 'student-123',
            student_number: mockMatricula,
            studentName: 'Aluno Teste',
            areaCorrectAnswers: { LC: 40, CH: 38, CN: 42, MT: 35 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).not.toBeNull()
    })
  })

  describe('analyzeStudentSimulado', () => {
    it('deve retornar resultado da tabela projetos quando disponível', async () => {
      const mockResult: SimuladoResult = {
        exam: {
          id: 'projeto-123',
          title: 'Simulado Teste',
          answer_key: [],
          question_contents: null,
        },
        studentAnswer: {
          id: 'answer-123',
          exam_id: 'projeto-123',
          student_number: mockMatricula,
          student_name: 'Aluno Teste',
          turma: '2A',
          answers: [],
          score: 750,
          correct_answers: 120,
          wrong_answers: 45,
          blank_answers: 15,
          tri_score: null,
          tri_lc: 650,
          tri_ch: 700,
          tri_cn: 800,
          tri_mt: 750,
          created_at: '2024-01-15T10:00:00Z',
        },
        wrongQuestions: [],
        topicsSummary: [
          { topic: 'Matemática - 10 erros para revisar', count: 10, questions: [136] },
        ],
      }

      // Mock para getSimuladoFromProjetos
      const mockProjeto = {
        id: 'projeto-123',
        simulado_nome: 'Simulado Teste',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: `merged-${mockMatricula}-1234567890`,
            matricula: mockMatricula,
            studentName: 'Aluno Teste',
            areaCorrectAnswers: { LC: 35, CH: 40, CN: 38, MT: 35 },
            areaScores: { LC: 650, CH: 700, CN: 800, MT: 750 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await analyzeStudentSimulado(mockMatricula)

      expect(result).not.toBeNull()
      expect(result?.exam.title).toBe('Simulado Teste')
    })

    it('deve fazer fallback para tabelas antigas quando projetos não encontra', async () => {
      // Mock projetos vazio
      const mockOrderProjetos = vi.fn().mockReturnValue({
        data: [],
        error: null,
      })
      
      // Mock students
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: mockStudent,
        error: null,
      })
      
      // Mock student_answers vazio
      const mockOrderAnswers = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const mockSelect = vi.fn()
        .mockReturnValueOnce({ order: mockOrderProjetos }) // projetos
        .mockReturnValueOnce({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }) // students
        .mockReturnValueOnce({ eq: vi.fn().mockReturnValue({ order: mockOrderAnswers }) }) // student_answers

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>))

      const result = await analyzeStudentSimulado(mockMatricula)

      expect(result).toBeNull()
    })

    it('deve retornar null quando não encontra dados em nenhuma fonte', async () => {
      // Mock todos vazios
      const mockOrder = vi.fn().mockReturnValue({
        data: [],
        error: null,
      })
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockSelect = vi.fn()
        .mockReturnValueOnce({ order: mockOrder }) // projetos
        .mockReturnValueOnce({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }) // students

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>))

      const result = await analyzeStudentSimulado('999999999')

      expect(result).toBeNull()
    })
  })

  describe('Fluxo completo de integração', () => {
    it('deve processar corretamente o fluxo: matrícula → busca → erros → distribuição', async () => {
      // 1. Buscar aluno
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: mockStudent,
        error: null,
      })
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const student = await getStudentByMatricula(mockMatricula)
      expect(student).not.toBeNull()
      expect(student?.matricula).toBe(mockMatricula)

      // 2. Buscar resultado do simulado
      const mockProjeto = {
        id: 'projeto-123',
        simulado_nome: 'Simulado ENEM',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: `merged-${mockMatricula}-1234567890`,
            matricula: mockMatricula,
            studentName: 'Aluno Teste',
            turma: '2A',
            areaCorrectAnswers: { LC: 35, CH: 40, CN: 38, MT: 35 },
            areaScores: { LC: 650, CH: 700, CN: 800, MT: 750 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ order: mockOrder }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await analyzeStudentSimulado(mockMatricula)
      
      // 3. Verificar estrutura do resultado
      expect(result).not.toBeNull()
      if (result) {
        // Deve ter dados do exame
        expect(result.exam).toBeDefined()
        expect(result.exam.title).toBe('Simulado ENEM')
        
        // Deve ter dados do aluno
        expect(result.studentAnswer).toBeDefined()
        expect(result.studentAnswer.student_number).toBe(mockMatricula)
        
        // Deve ter questões erradas (calculadas a partir dos acertos)
        expect(Array.isArray(result.wrongQuestions)).toBe(true)
        expect(result.wrongQuestions.length).toBeGreaterThan(0)
        
        // Deve ter sumário de tópicos
        expect(Array.isArray(result.topicsSummary)).toBe(true)
        expect(result.topicsSummary.length).toBeGreaterThan(0)
        
        // Verificar estrutura dos tópicos
        result.topicsSummary.forEach(topic => {
          expect(topic).toHaveProperty('topic')
          expect(topic).toHaveProperty('count')
          expect(topic).toHaveProperty('questions')
          expect(typeof topic.topic).toBe('string')
          expect(typeof topic.count).toBe('number')
          expect(Array.isArray(topic.questions)).toBe(true)
        })
      }
    })
  })

  describe('Cálculo de erros por área do ENEM', () => {
    it('deve calcular corretamente os erros de cada área do ENEM', async () => {
      const mockProjeto = {
        id: 'projeto-123',
        simulado_nome: 'Simulado Completo',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: `merged-${mockMatricula}-1234567890`,
            matricula: mockMatricula,
            studentName: 'Aluno Teste',
            areaCorrectAnswers: {
              LC: 35, // 10 erros em Linguagens (Q1-45)
              CH: 40, // 5 erros em Humanas (Q46-90)
              CN: 38, // 7 erros em Natureza (Q91-135)
              MT: 35, // 10 erros em Matemática (Q136-180)
            },
            areaScores: { LC: 600, CH: 650, CN: 700, MT: 650 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ order: mockOrder }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).not.toBeNull()
      if (result) {
        // Deve ter 4 tópicos (um para cada área)
        expect(result.topicsSummary.length).toBe(4)
        
        // Verificar se cada área está representada
        const topics = result.topicsSummary.map(t => t.topic)
        expect(topics.some(t => t.includes('Linguagens'))).toBe(true)
        expect(topics.some(t => t.includes('Humanas'))).toBe(true)
        expect(topics.some(t => t.includes('Natureza'))).toBe(true)
        expect(topics.some(t => t.includes('Matemática'))).toBe(true)
        
        // Verificar os contadores de erros
        const linguagensTopic = result.topicsSummary.find(t => t.topic.includes('Linguagens'))
        expect(linguagensTopic?.count).toBe(10) // 45 - 35 = 10 erros
        
        const humanasTopic = result.topicsSummary.find(t => t.topic.includes('Humanas'))
        expect(humanasTopic?.count).toBe(5) // 45 - 40 = 5 erros
        
        const naturezaTopic = result.topicsSummary.find(t => t.topic.includes('Natureza'))
        expect(naturezaTopic?.count).toBe(7) // 45 - 38 = 7 erros
        
        const matematicaTopic = result.topicsSummary.find(t => t.topic.includes('Matemática'))
        expect(matematicaTopic?.count).toBe(10) // 45 - 35 = 10 erros
      }
    })

    it('deve ignorar áreas sem erros', async () => {
      const mockProjeto = {
        id: 'projeto-123',
        simulado_nome: 'Simulado Perfeito',
        created_at: '2024-01-15T10:00:00Z',
        students: [
          {
            id: `merged-${mockMatricula}-1234567890`,
            matricula: mockMatricula,
            studentName: 'Aluno Teste',
            areaCorrectAnswers: {
              LC: 45, // 0 erros
              CH: 45, // 0 erros
              CN: 45, // 0 erros
              MT: 45, // 0 erros
            },
            areaScores: { LC: 800, CH: 800, CN: 800, MT: 800 },
          },
        ],
      }

      const mockOrder = vi.fn().mockReturnValue({
        data: [mockProjeto],
        error: null,
      })
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ order: mockOrder }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getSimuladoFromProjetos(mockMatricula)

      expect(result).not.toBeNull()
      if (result) {
        // Não deve haver tópicos quando não há erros
        expect(result.wrongQuestions.length).toBe(0)
        expect(result.topicsSummary.length).toBe(0)
      }
    })
  })
})
