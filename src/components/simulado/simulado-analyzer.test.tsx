import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SimuladoAnalyzer } from './simulado-analyzer'
import { useCronogramaStore } from '../../stores/cronograma-store'
import type { TimeSlotsByTurno } from '../../stores/cronograma-store'
import * as simuladoService from '../../services/simulado-analyzer'
import type {
  SimuladoHistoryItem,
  SimuladoResult,
} from '../../types/supabase'
import type { Aluno, BlocoCronograma, Cronograma, HorarioOficial } from '../../types/domain'

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
      officialSchedule: [] as HorarioOficial[],
      slotsOverride: null as TimeSlotsByTurno | null,
      cronograma: mockCronograma,
      currentStudent: mockStudent,
      selectedWeek: new Date('2026-05-11T12:00:00Z'),
      simuladoHistory: [] as SimuladoHistoryItem[],
      selectedSimuladoHistoryItem: null as SimuladoHistoryItem | null,
      selectedSimuladoResult: null as SimuladoResult | null,
      addBlock: vi.fn().mockResolvedValue({ id: 'block-1' }),
      removeBlock: vi.fn().mockResolvedValue(undefined),
      createCronograma: vi.fn().mockResolvedValue(mockCronograma),
      loadCronogramaVersions: vi.fn().mockResolvedValue(undefined),
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

  it('distribui em turnos livres mesmo sem entrada na grade oficial, exclui apenas aulas reais', async () => {
    // Grade oficial tem apenas slots de tarde (placeholders = livres).
    // Com a lógica correta, manha também está livre (sem aula real lá)
    // e deve ser preenchida antes de tarde/fds (iteração: manha → tarde → noite).
    storeState.officialSchedule = [
      {
        id: 'db-1',
        turma: 'Turma 300',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:45',
        disciplina: '—', // placeholder — não bloqueia
        professor: null,
      },
      {
        id: 'db-2',
        turma: 'Turma 300',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '15:45',
        horarioFim: '16:30',
        disciplina: '—', // placeholder — não bloqueia
        professor: null,
      },
    ]
    storeState.slotsOverride = {
      manha: [
        { inicio: '07:20', fim: '08:05' },
        { inicio: '08:05', fim: '08:50' },
      ],
      tarde: [
        { inicio: '15:00', fim: '15:45' },
        { inicio: '15:45', fim: '16:30' },
      ],
      noite: [
        { inicio: '19:30', fim: '20:30' },
        { inicio: '20:30', fim: '21:30' },
      ],
    }
    storeState.blocks = [
      {
        id: 'blocked-1',
        cronogramaId: mockCronograma.id,
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:45',
        tipo: 'rotina',
        titulo: 'Bloqueado',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0,
        concluido: false,
        createdAt: new Date(),
      },
    ]

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Serão distribuídas 2 questões nesta semana.',
        ),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

    await waitFor(() => {
      expect(storeState.addBlock).toHaveBeenCalledTimes(2)
    })

    // Iteração: segunda→manha antes de tarde → primeiro slot livre é segunda-manha-07:20
    const blockData = storeState.addBlock.mock.calls[0][0] as Omit<
      BlocoCronograma,
      'id' | 'createdAt'
    >
    expect(blockData.diaSemana).toBe('segunda')
    expect(blockData.turno).toBe('manha')
    expect(blockData.horarioInicio).toBe('07:20')
    expect(blockData.horarioFim).toBe('08:05')

    const blockData2 = storeState.addBlock.mock.calls[1][0] as Omit<
      BlocoCronograma,
      'id' | 'createdAt'
    >
    expect(blockData2.diaSemana).toBe('segunda')
    expect(blockData2.turno).toBe('manha')
    expect(blockData2.horarioInicio).toBe('08:05')
    expect(blockData2.horarioFim).toBe('08:50')
  })

  it('fecha o modal mesmo quando sobram questoes pendentes por falta de horario', async () => {
    // Segunda: slot livre (placeholder). Terça-sexta: aulas reais bloqueiam o mesmo horário.
    // Assim apenas segunda-tarde-15:00 fica disponível em dias de semana.
    storeState.officialSchedule = [
      {
        id: 'db-1',
        turma: 'Turma 300',
        diaSemana: 'segunda',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        disciplina: '—', // placeholder — livre
        professor: null,
      },
      {
        id: 'db-terca',
        turma: 'Turma 300',
        diaSemana: 'terca',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        disciplina: 'MATEMÁTICA',
        professor: null,
      },
      {
        id: 'db-quarta',
        turma: 'Turma 300',
        diaSemana: 'quarta',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        disciplina: 'PORTUGUÊS',
        professor: null,
      },
      {
        id: 'db-quinta',
        turma: 'Turma 300',
        diaSemana: 'quinta',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        disciplina: 'FÍSICA',
        professor: null,
      },
      {
        id: 'db-sexta',
        turma: 'Turma 300',
        diaSemana: 'sexta',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        disciplina: 'QUÍMICA',
        professor: null,
      },
    ]
    storeState.slotsOverride = {
      manha: [],
      tarde: [{ inicio: '15:00', fim: '15:50' }],
      noite: [],
    }
    storeState.blocks = [
      {
        id: 'blocked-saturday',
        cronogramaId: mockCronograma.id,
        diaSemana: 'sabado',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        tipo: 'rotina',
        titulo: 'Bloqueado',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0,
        concluido: false,
        createdAt: new Date(),
      },
      {
        id: 'blocked-sunday',
        cronogramaId: mockCronograma.id,
        diaSemana: 'domingo',
        turno: 'tarde',
        horarioInicio: '15:00',
        horarioFim: '15:50',
        tipo: 'rotina',
        titulo: 'Bloqueado',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0,
        concluido: false,
        createdAt: new Date(),
      },
    ]

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Nesta semana cabem 1 de 2 questões. 1 ficará pendente por falta de horários livres.',
        ),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

    await waitFor(() => {
      expect(storeState.addBlock).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Simulado ENEM 2024')).not.toBeInTheDocument()
    })
  })

  it('substitui questoes ja distribuidas antes de recriar a sequencia', async () => {
    storeState.blocks = [
      {
        id: 'existing-q1',
        cronogramaId: mockCronograma.id,
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:15',
        horarioFim: '08:05',
        tipo: 'revisao',
        titulo: 'Interpretação de Texto',
        descricao: 'Questão 1 - Revisão de erro',
        disciplinaCodigo: null,
        cor: '#3B82F6',
        prioridade: 1,
        concluido: false,
        createdAt: new Date(),
      },
    ]

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Serão distribuídas 2 questões nesta semana.',
        ),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuir \(2\)/i }))

    await waitFor(() => {
      expect(storeState.removeBlock).toHaveBeenCalledWith('existing-q1')
      expect(storeState.addBlock).toHaveBeenCalledTimes(2)
    })

    const blockData = storeState.addBlock.mock.calls[0][0] as Omit<
      BlocoCronograma,
      'id' | 'createdAt'
    >
    expect(blockData.descricao).toBe('Questão 1 - Revisão de erro')
    expect(blockData.titulo).toBe('Interpretação de Texto')
  })

  it('ignora clique duplicado enquanto a distribuição está em andamento', async () => {
    const pendingResolutions: Array<() => void> = []
    storeState.addBlock.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingResolutions.push(() => resolve({ id: 'block-delayed' }))
        }),
    )

    render(<SimuladoAnalyzer matricula={mockMatricula} />)

    await waitFor(() => {
      expect(storeState.selectedSimuladoHistoryItem?.id).toBe(latestHistoryItem.id)
    })

    fireEvent.click(screen.getByText('Simulado'))

    await waitFor(() => {
      expect(screen.getByText('2 de 2 selecionadas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

    await waitFor(() => {
      expect(storeState.addBlock).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: /Distribuindo/i })).toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /Distribuindo/i }))
    expect(storeState.addBlock).toHaveBeenCalledTimes(1)

    pendingResolutions.shift()?.()

    await waitFor(() => {
      expect(storeState.addBlock).toHaveBeenCalledTimes(2)
    })

    pendingResolutions.shift()?.()

    await waitFor(() => {
      expect(screen.queryByText('Simulado ENEM 2024')).not.toBeInTheDocument()
    })

    expect(storeState.addBlock).toHaveBeenCalledTimes(2)
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
