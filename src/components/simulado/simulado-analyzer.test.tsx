import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SimuladoAnalyzer } from './simulado-analyzer'
import { useCronogramaStore } from '../../stores/cronograma-store'
import * as simuladoService from '../../services/simulado-analyzer'
import type { SimuladoResult } from '../../types/supabase'
import type { Aluno, BlocoCronograma, Cronograma } from '../../types/domain'

vi.mock('../../services/simulado-analyzer')
vi.mock('../../stores/cronograma-store')

describe('SimuladoAnalyzer', () => {
  const mockMatricula = '214140291'

  const mockStudent: Aluno = {
    id: 'student-1',
    matricula: mockMatricula,
    nome: 'Aluno Teste',
    turma: '2A',
    email: null,
    escola: 'MARISTA',
    fotoFilename: null,
    createdAt: new Date(),
  }

  const mockCronograma: Cronograma = {
    id: 'cronograma-1',
    alunoId: mockStudent.id,
    semanaInicio: new Date(),
    semanaFim: new Date(),
    observacoes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'ativo',
  }

  const mockResult: SimuladoResult = {
    exam: {
      id: 'exam-1',
      title: 'Simulado ENEM 2024',
      answer_key: [],
      question_contents: null,
    },
    studentAnswer: {
      id: 'answer-1',
      exam_id: 'exam-1',
      student_number: mockMatricula,
      student_name: 'Aluno Teste',
      turma: '2A',
      answers: [],
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
    },
    wrongQuestions: [
      { questionNumber: 1, topic: 'Interpretação de Texto', studentAnswer: 'B', correctAnswer: 'A' },
      { questionNumber: 136, topic: 'Álgebra', studentAnswer: 'C', correctAnswer: 'D' },
    ],
    topicsSummary: [
      { topic: 'Interpretação de Texto', count: 1, questions: [1] },
      { topic: 'Álgebra', count: 1, questions: [136] },
    ],
  }

  const storeState = {
    blocks: [] as BlocoCronograma[],
    officialSchedule: [],
    cronograma: mockCronograma,
    currentStudent: mockStudent,
    addBlock: vi.fn().mockResolvedValue({ id: 'block-1' }),
    createCronograma: vi.fn().mockResolvedValue(mockCronograma),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCronogramaStore).mockImplementation((selector) =>
      selector(storeState as never),
    )
    vi.mocked(simuladoService.analyzeStudentSimulado).mockResolvedValue(mockResult)
    vi.mocked(simuladoService.diagnoseStudentAnswers).mockResolvedValue(undefined)
  })

  it('renderiza botão de análise no estado inicial', () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    expect(screen.getByText('Analisar Simulado')).toBeInTheDocument()
  })

  it('exibe resultado e seleciona todas as questões por padrão', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    fireEvent.click(screen.getByText('Analisar Simulado'))

    await waitFor(() => {
      expect(screen.getByText('Simulado ENEM 2024')).toBeInTheDocument()
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked()
    })
  })

  it('desabilita distribuição quando nenhuma questão está selecionada', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    fireEvent.click(screen.getByText('Analisar Simulado'))

    await waitFor(() => {
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Limpar seleção'))

    await waitFor(() => {
      expect(screen.getByText('Selecione pelo menos uma questão')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Distribuir/i })).toBeDisabled()
    })
  })

  it('distribui apenas as questões selecionadas', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    fireEvent.click(screen.getByText('Analisar Simulado'))

    await waitFor(() => {
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])

    await waitFor(() => {
      expect(screen.getByText('1 de 2 selecionadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

    await waitFor(() => {
      expect(storeState.addBlock).toHaveBeenCalledTimes(1)
    })

    const blockData = storeState.addBlock.mock.calls[0][0] as Omit<
      BlocoCronograma,
      'id' | 'createdAt'
    >
    expect(blockData.tipo).toBe('revisao')
    expect(blockData.titulo).toBe('Interpretação de Texto')
  })

  it('exibe erro quando não encontra simulado', async () => {
    vi.mocked(simuladoService.analyzeStudentSimulado).mockResolvedValue(null)

    render(<SimuladoAnalyzer matricula={mockMatricula} />)
    fireEvent.click(screen.getByText('Analisar Simulado'))

    await waitFor(() => {
      expect(screen.getByText('Nenhum simulado encontrado para este aluno')).toBeInTheDocument()
    })
  })

  it('exibe erro quando análise falha', async () => {
    vi.mocked(simuladoService.analyzeStudentSimulado).mockRejectedValue(new Error('Falha'))

    render(<SimuladoAnalyzer matricula={mockMatricula} />)
    fireEvent.click(screen.getByText('Analisar Simulado'))

    await waitFor(() => {
      expect(screen.getByText('Erro ao analisar simulado')).toBeInTheDocument()
    })
  })
})
