import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SimuladoAnalyzer } from './simulado-analyzer'
import { useCronogramaStore } from '../../stores/cronograma-store'
import * as simuladoService from '../../services/simulado-analyzer'
import type {
  SimuladoHistoryItem,
  SimuladoResult,
} from '../../types/supabase'
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

  const latestHistoryItem: SimuladoHistoryItem = {
    id: 'projetos:latest',
    source: 'projetos',
    title: 'Simulado ENEM 2024',
    date: '2024-01-15T10:00:00Z',
    isLatest: true,
    projectId: 'projeto-1',
    projectStudentId: 'merged-214140291-1',
    studentNumber: mockMatricula,
  }

  const olderHistoryItem: SimuladoHistoryItem = {
    id: 'projetos:older',
    source: 'projetos',
    title: 'Simulado Diagnóstico',
    date: '2023-11-20T10:00:00Z',
    isLatest: false,
    projectId: 'projeto-2',
    projectStudentId: 'merged-214140291-2',
    studentNumber: mockMatricula,
  }

  const latestResult: SimuladoResult = {
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

  const olderResult: SimuladoResult = {
    exam: {
      id: 'exam-2',
      title: 'Simulado Diagnóstico',
      answer_key: [],
      question_contents: null,
    },
    studentAnswer: {
      ...latestResult.studentAnswer,
      id: 'answer-2',
      exam_id: 'exam-2',
      correct_answers: 100,
      wrong_answers: 60,
      blank_answers: 20,
      tri_lc: 600,
      tri_ch: 640,
      tri_cn: 620,
      tri_mt: 680,
      created_at: '2023-11-20T10:00:00Z',
    },
    wrongQuestions: [
      { questionNumber: 50, topic: 'História do Brasil', studentAnswer: 'B', correctAnswer: 'D' },
    ],
    topicsSummary: [{ topic: 'História do Brasil', count: 1, questions: [50] }],
  }

  const createStoreState = () => {
    const state = {
      blocks: [] as BlocoCronograma[],
      officialSchedule: [],
      cronograma: mockCronograma,
      currentStudent: mockStudent,
      simuladoHistory: [] as SimuladoHistoryItem[],
      selectedSimuladoHistoryItem: null as SimuladoHistoryItem | null,
      selectedSimuladoResult: null as SimuladoResult | null,
      addBlock: vi.fn().mockResolvedValue({ id: 'block-1' }),
      createCronograma: vi.fn().mockResolvedValue(mockCronograma),
      setSimuladoHistory: vi.fn((history: SimuladoHistoryItem[]) => {
        state.simuladoHistory = history
      }),
      setSelectedSimuladoHistoryItem: vi.fn((item: SimuladoHistoryItem | null) => {
        state.selectedSimuladoHistoryItem = item
      }),
      setSelectedSimuladoResult: vi.fn((result: SimuladoResult | null) => {
        state.selectedSimuladoResult = result
      }),
      resetSimuladoState: vi.fn(() => {
        state.simuladoHistory = []
        state.selectedSimuladoHistoryItem = null
        state.selectedSimuladoResult = null
      }),
    }

    return state
  }

  let storeState = createStoreState()

  beforeEach(() => {
    vi.clearAllMocks()
    storeState = createStoreState()

    vi.mocked(useCronogramaStore).mockImplementation((selector) =>
      selector(storeState as never),
    )

    vi.mocked(simuladoService.listStudentSimulados).mockResolvedValue([
      latestHistoryItem,
      olderHistoryItem,
    ])
    vi.mocked(simuladoService.getSimuladoResultByHistoryItem).mockImplementation(
      async (item) => {
        return item.id === latestHistoryItem.id ? latestResult : olderResult
      },
    )
    vi.mocked(simuladoService.diagnoseStudentAnswers).mockResolvedValue(undefined)
  })

  it('renderiza o botão Simulado no estado inicial', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    expect(screen.getByText('Simulado')).toBeInTheDocument()

    await waitFor(() => {
      expect(simuladoService.listStudentSimulados).toHaveBeenCalledWith(mockMatricula)
    })
  })

  it('abre o simulado mais recente e seleciona todas as questões por padrão', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

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

  it('permite trocar o simulado ativo pelo dropdown', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByLabelText('Selecionar simulado'))
    fireEvent.click(screen.getByRole('button', { name: /Simulado Diagnóstico/i }))

    await waitFor(() => {
      expect(screen.getByText('Simulado Diagnóstico')).toBeInTheDocument()
      expect(screen.getByText('1 de 1 selecionadas')).toBeInTheDocument()
    })

    expect(storeState.selectedSimuladoHistoryItem?.id).toBe(olderHistoryItem.id)
    expect(simuladoService.getSimuladoResultByHistoryItem).toHaveBeenCalledWith(
      olderHistoryItem,
    )
  })

  it('desabilita distribuição quando nenhuma questão está selecionada', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Limpar seleção'))

    await waitFor(() => {
      expect(screen.getByText('Selecione pelo menos uma questão')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Distribuir/i })).toBeDisabled()
    })
  })

  it('distribui apenas as questões selecionadas do simulado ativo', async () => {
    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

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

  it('exibe erro quando não encontra histórico de simulados', async () => {
    vi.mocked(simuladoService.listStudentSimulados).mockResolvedValue([])

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(screen.getByTitle('Nenhum simulado encontrado')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(
        screen.getByText('Nenhum simulado encontrado para este aluno'),
      ).toBeInTheDocument()
    })
  })

  it('exibe erro quando a carga do resultado falha', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(simuladoService.getSimuladoResultByHistoryItem).mockRejectedValue(
      new Error('Falha'),
    )

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(screen.getByText('Erro ao analisar simulado')).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })
})
