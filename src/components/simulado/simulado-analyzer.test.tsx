import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SimuladoAnalyzer } from './simulado-analyzer'
import { useCronogramaStore } from '../../stores/cronograma-store'
import * as simuladoAnalyzer from '../../services/simulado-analyzer'
import type { SimuladoResult } from '../../types/supabase'
import type { BlocoCronograma, Cronograma, Aluno } from '../../types/domain'

// Mock dos módulos
vi.mock('../../services/simulado-analyzer')
vi.mock('../../stores/cronograma-store')

describe('SimuladoAnalyzer Component', () => {
  const mockMatricula = '214140291'

  const mockStudent: Aluno = {
    id: 'student-123',
    matricula: mockMatricula,
    nome: 'Aluno Teste',
    turma: '2A',
    email: null,
    escola: 'MARISTA',
    fotoFilename: null,
    createdAt: new Date(),
  }

  const mockCronograma: Cronograma = {
    id: 'cronograma-123',
    alunoId: mockStudent.id,
    semanaInicio: new Date(),
    semanaFim: new Date(),
    observacoes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'ativo',
  }

  const mockSimuladoResult: SimuladoResult = {
    exam: {
      id: 'exam-123',
      title: 'Simulado ENEM 2024',
      answer_key: [],
      question_contents: null,
    },
    studentAnswer: {
      id: 'answer-123',
      exam_id: 'exam-123',
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
      { topic: 'Linguagens - 10 erros para revisar', count: 10, questions: [1] },
      { topic: 'Matemática - 10 erros para revisar', count: 10, questions: [136] },
      { topic: 'Natureza - 5 erros para revisar', count: 5, questions: [91] },
      { topic: 'Humanas - 8 erros para revisar', count: 8, questions: [46] },
    ],
  }

  const mockStore = {
    blocks: [] as BlocoCronograma[],
    officialSchedule: [],
    cronograma: mockCronograma,
    currentStudent: mockStudent,
    addBlock: vi.fn(),
    createCronograma: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCronogramaStore).mockReturnValue(mockStore)
    vi.mocked(simuladoAnalyzer.analyzeStudentSimulado).mockResolvedValue(mockSimuladoResult)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Renderização inicial', () => {
    it('deve renderizar botão de análise', () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      expect(screen.getByText('Analisar Simulado')).toBeInTheDocument()
    })

    it('deve renderizar botão de diagnóstico', () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      expect(screen.getByText('🔍 Diagnóstico')).toBeInTheDocument()
    })
  })

  describe('Análise de simulado', () => {
    it('deve buscar e exibir resultado do simulado ao clicar em analisar', async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(simuladoAnalyzer.analyzeStudentSimulado).toHaveBeenCalledWith(mockMatricula)
      })

      await waitFor(() => {
        expect(screen.getByText('Simulado ENEM 2024')).toBeInTheDocument()
      })
    })

    it('deve selecionar todos os tópicos por padrão', async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(screen.getByText('4 de 4 selecionados')).toBeInTheDocument()
      })

      // Verificar que todos os checkboxes estão marcados
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBe(4)
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })
    })

    it('deve exibir estatísticas do aluno', async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(screen.getByText(/120 acertos/)).toBeInTheDocument()
        expect(screen.getByText(/45 erros/)).toBeInTheDocument()
        expect(screen.getByText(/15 em branco/)).toBeInTheDocument()
      })
    })
  })

  describe('Seleção de tópicos', () => {
    beforeEach(async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)
      fireEvent.click(screen.getByText('Analisar Simulado'))
      await waitFor(() => {
        expect(screen.getByText('Selecione os tópicos para revisar')).toBeInTheDocument()
      })
    })

    it('deve permitir desmarcar um tópico individualmente', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Desmarcar o primeiro tópico
      fireEvent.click(checkboxes[0])

      await waitFor(() => {
        expect(screen.getByText('3 de 4 selecionados')).toBeInTheDocument()
      })

      expect(checkboxes[0]).not.toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      expect(checkboxes[2]).toBeChecked()
      expect(checkboxes[3]).toBeChecked()
    })

    it('deve permitir marcar um tópico individualmente', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Desmarcar todos primeiro
      fireEvent.click(screen.getByText('Limpar seleção'))

      await waitFor(() => {
        expect(screen.getByText('0 de 4 selecionados')).toBeInTheDocument()
      })

      // Marcar apenas o primeiro
      fireEvent.click(checkboxes[0])

      await waitFor(() => {
        expect(screen.getByText('1 de 4 selecionados')).toBeInTheDocument()
      })

      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })

    it('deve permitir selecionar todos via botão', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Desmarcar todos primeiro
      fireEvent.click(screen.getByText('Limpar seleção'))

      await waitFor(() => {
        expect(screen.getByText('0 de 4 selecionados')).toBeInTheDocument()
      })

      // Selecionar todos
      fireEvent.click(screen.getByText('Selecionar todos'))

      await waitFor(() => {
        expect(screen.getByText('4 de 4 selecionados')).toBeInTheDocument()
      })

      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })
    })

    it('deve atualizar o contador ao selecionar/deselecionar', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      expect(screen.getByText('4 de 4 selecionados')).toBeInTheDocument()

      fireEvent.click(checkboxes[0])
      expect(screen.getByText('3 de 4 selecionados')).toBeInTheDocument()

      fireEvent.click(checkboxes[1])
      expect(screen.getByText('2 de 4 selecionados')).toBeInTheDocument()

      fireEvent.click(checkboxes[0])
      expect(screen.getByText('3 de 4 selecionados')).toBeInTheDocument()
    })

    it('deve mostrar mensagem quando nenhum tópico está selecionado', async () => {
      fireEvent.click(screen.getByText('Limpar seleção'))

      await waitFor(() => {
        expect(screen.getByText('Selecione pelo menos um tópico')).toBeInTheDocument()
      })

      const distributeButton = screen.getByRole('button', { name: /Distribuir/i })
      expect(distributeButton).toBeDisabled()
    })
  })

  describe('Distribuição de tópicos selecionados', () => {
    beforeEach(async () => {
      mockStore.addBlock.mockResolvedValue({ id: 'block-123' })
      render(<SimuladoAnalyzer matricula={mockMatricula} />)
      fireEvent.click(screen.getByText('Analisar Simulado'))
      await waitFor(() => {
        expect(screen.getByText('Distribuir')).toBeInTheDocument()
      })
    })

    it('deve distribuir apenas os tópicos selecionados', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Desmarcar 2 tópicos, deixar apenas 2 selecionados
      fireEvent.click(checkboxes[2])
      fireEvent.click(checkboxes[3])

      await waitFor(() => {
        expect(screen.getByText('2 de 4 selecionados')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

      await waitFor(() => {
        expect(mockStore.addBlock).toHaveBeenCalledTimes(2)
      })
    })

    it('deve mostrar quantidade correta no botão de distribuir', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      fireEvent.click(checkboxes[2])
      fireEvent.click(checkboxes[3])

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Distribuir \(2\)/i })
        expect(button).toBeInTheDocument()
      })
    })

    it('deve criar blocos com dados corretos para tópicos selecionados', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Deixar apenas 1 tópico selecionado
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])
      fireEvent.click(checkboxes[3])

      fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

      await waitFor(() => {
        expect(mockStore.addBlock).toHaveBeenCalledTimes(1)

        const blockData = mockStore.addBlock.mock.calls[0][0] as Omit<BlocoCronograma, 'id' | 'createdAt'>
        expect(blockData).toHaveProperty('tipo', 'revisao')
        expect(blockData).toHaveProperty('titulo', 'Linguagens - 10 erros para revisar')
        expect(blockData).toHaveProperty('prioridade', 2) // 10 erros = urgente
      })
    })

    it('deve criar cronograma se não existir', async () => {
      const storeWithoutCronograma = {
        ...mockStore,
        cronograma: null,
      }
      vi.mocked(useCronogramaStore).mockReturnValue(storeWithoutCronograma)
      mockStore.createCronograma.mockResolvedValue(mockCronograma)

      fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

      await waitFor(() => {
        expect(mockStore.createCronograma).toHaveBeenCalled()
      })
    })
  })

  describe('Prioridades e cores dos blocos', () => {
    beforeEach(async () => {
      mockStore.addBlock.mockResolvedValue({ id: 'block-123' })
      render(<SimuladoAnalyzer matricula={mockMatricula} />)
      fireEvent.click(screen.getByText('Analisar Simulado'))
      await waitFor(() => {
        expect(screen.getByText('Distribuir')).toBeInTheDocument()
      })
    })

    it('deve atribuir prioridade correta baseada na quantidade de erros', async () => {
      fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

      await waitFor(() => {
        const calls = mockStore.addBlock.mock.calls

        calls.forEach((call, index) => {
          const block = call[0] as Omit<BlocoCronograma, 'id' | 'createdAt'>
          const topic = mockSimuladoResult.topicsSummary[index]

          if (topic.count >= 3) {
            expect(block.prioridade).toBe(2) // Urgente
          } else if (topic.count >= 2) {
            expect(block.prioridade).toBe(1) // Alta
          } else {
            expect(block.prioridade).toBe(0) // Normal
          }
        })
      })
    })

    it('deve atribuir cor baseada na área do ENEM', async () => {
      fireEvent.click(screen.getByRole('button', { name: /Distribuir/i }))

      await waitFor(() => {
        const calls = mockStore.addBlock.mock.calls

        const linguagensBlock = calls.find(call =>
          (call[0] as Omit<BlocoCronograma, 'id' | 'createdAt'>).titulo.includes('Linguagens')
        )
        const humanasBlock = calls.find(call =>
          (call[0] as Omit<BlocoCronograma, 'id' | 'createdAt'>).titulo.includes('Humanas')
        )
        const naturezaBlock = calls.find(call =>
          (call[0] as Omit<BlocoCronograma, 'id' | 'createdAt'>).titulo.includes('Natureza')
        )
        const matematicaBlock = calls.find(call =>
          (call[0] as Omit<BlocoCronograma, 'id' | 'createdAt'>).titulo.includes('Matemática')
        )

        expect(linguagensBlock?.[0]).toHaveProperty('cor', '#3B82F6') // Azul
        expect(humanasBlock?.[0]).toHaveProperty('cor', '#F97316') // Laranja
        expect(naturezaBlock?.[0]).toHaveProperty('cor', '#10B981') // Verde
        expect(matematicaBlock?.[0]).toHaveProperty('cor', '#EF4444') // Vermelho
      })
    })
  })

  describe('Indicadores visuais de tópicos', () => {
    beforeEach(async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)
      fireEvent.click(screen.getByText('Analisar Simulado'))
      await waitFor(() => {
        expect(screen.getByText('Selecione os tópicos para revisar')).toBeInTheDocument()
      })
    })

    it('deve exibir badge vermelho para tópicos com 3+ erros', () => {
      const badges = screen.getAllByText(/10 erros/)
      expect(badges.length).toBeGreaterThan(0)
    })

    it('deve exibir badge amarelo para tópicos com 2 erros', async () => {
      const resultWithTwoErrors = {
        ...mockSimuladoResult,
        topicsSummary: [
          { topic: 'Tópico com 2 erros', count: 2, questions: [1, 2] },
        ],
      }
      vi.mocked(simuladoAnalyzer.analyzeStudentSimulado).mockResolvedValue(resultWithTwoErrors)

      fireEvent.click(screen.getByText('Cancelar'))
      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        const badge = screen.getByText(/2 erro/)
        expect(badge.className).toContain('bg-yellow-100')
        expect(badge.className).toContain('text-yellow-700')
      })
    })

    it('deve destacar visualmente tópicos selecionados', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Verificar que todos estão com estilo de selecionado
      const labels = screen.getAllByRole('checkbox').map(cb => cb.closest('label'))

      labels.forEach(label => {
        expect(label?.className).toContain('bg-blue-50')
        expect(label?.className).toContain('border-blue-200')
      })

      // Desmarcar um e verificar mudança de estilo
      fireEvent.click(checkboxes[0])

      await waitFor(() => {
        const deselectedLabel = checkboxes[0].closest('label')
        expect(deselectedLabel?.className).toContain('bg-white')
        expect(deselectedLabel?.className).not.toContain('bg-blue-50')
      })
    })
  })

  describe('Fechar resultado', () => {
    beforeEach(async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)
      fireEvent.click(screen.getByText('Analisar Simulado'))
      await waitFor(() => {
        expect(screen.getByText('Simulado ENEM 2024')).toBeInTheDocument()
      })
    })

    it('deve limpar seleção ao fechar', async () => {
      const checkboxes = screen.getAllByRole('checkbox')

      // Desmarcar alguns
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      await waitFor(() => {
        expect(screen.getByText('2 de 4 selecionados')).toBeInTheDocument()
      })

      // Fechar
      fireEvent.click(screen.getByLabelText('Fechar'))

      await waitFor(() => {
        expect(screen.queryByText('Simulado ENEM 2024')).not.toBeInTheDocument()
      })

      // Reabrir
      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        // Deve voltar a ter todos selecionados
        expect(screen.getByText('4 de 4 selecionados')).toBeInTheDocument()
      })
    })

    it('deve fechar ao clicar em Cancelar', async () => {
      fireEvent.click(screen.getByText('Cancelar'))

      await waitFor(() => {
        expect(screen.queryByText('Simulado ENEM 2024')).not.toBeInTheDocument()
        expect(screen.getByText('Analisar Simulado')).toBeInTheDocument()
      })
    })
  })

  describe('Tratamento de erros', () => {
    it('deve exibir mensagem quando não há simulado', async () => {
      vi.mocked(simuladoAnalyzer.analyzeStudentSimulado).mockResolvedValue(null)

      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(screen.getByText('Nenhum simulado encontrado para este aluno')).toBeInTheDocument()
      })
    })

    it('deve exibir mensagem de erro em caso de falha na análise', async () => {
      vi.mocked(simuladoAnalyzer.analyzeStudentSimulado).mockRejectedValue(new Error('API Error'))

      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(screen.getByText('Erro ao analisar simulado')).toBeInTheDocument()
      })
    })

    it('deve desabilitar botão de distribuir quando nenhum tópico selecionado', async () => {
      render(<SimuladoAnalyzer matricula={mockMatricula} />)

      fireEvent.click(screen.getByText('Analisar Simulado'))

      await waitFor(() => {
        expect(screen.getByText('Distribuir')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Limpar seleção'))

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Distribuir/i })
        expect(button).toBeDisabled()
      })
    })
  })
})
