import { useState, useCallback, useMemo } from 'react'
import { Button } from '../ui/button'
import type { SimuladoResult, WrongQuestion } from '../../types/supabase'
import type { BlocoCronograma, DiaSemana, Turno } from '../../types/domain'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, TURNOS } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { getColorFromQuestionNumber } from '../../constants/colors'
import type { PlanoEstudo } from '../../services/maritaca'
import { PlanoEstudoIA } from './plano-estudo-ia'

type SimuladoAnalyzerProps = {
  matricula: string
}

export function SimuladoAnalyzer({ matricula }: SimuladoAnalyzerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [result, setResult] = useState<SimuladoResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plano, setPlano] = useState<PlanoEstudo | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())

  const blocks = useCronogramaStore((state) => state.blocks)
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const addBlock = useCronogramaStore((state) => state.addBlock)
  const cronograma = useCronogramaStore((state) => state.cronograma)
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const createCronograma = useCronogramaStore((state) => state.createCronograma)

  const preloadAnalyzer = () => {
    void import('../../services/simulado-analyzer')
  }

  const handleAnalyze = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { analyzeStudentSimulado } = await import('../../services/simulado-analyzer')
      const data = await analyzeStudentSimulado(matricula)
      if (data) {
        setResult(data)
        // Selecionar todas as questões erradas por padrão
        setSelectedQuestions(new Set(data.wrongQuestions.map(q => q.questionNumber)))
      } else {
        setError('Nenhum simulado encontrado para este aluno')
      }
    } catch (err) {
      setError('Erro ao analisar simulado')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGerarPlano = async () => {
    setIsGeneratingPlan(true)
    setError(null)
    setPlano(null)

    try {
      // Se ainda não analisou o simulado, analisar primeiro
      let simuladoResult = result
      if (!simuladoResult) {
        const { analyzeStudentSimulado } = await import('../../services/simulado-analyzer')
        const data = await analyzeStudentSimulado(matricula)
        if (!data) {
          setError('Nenhum simulado encontrado para gerar o plano')
          return
        }
        simuladoResult = data
        setResult(data)
        setSelectedQuestions(new Set(data.wrongQuestions.map(q => q.questionNumber)))
      }

      const { gerarPlanoEstudo } = await import('../../services/maritaca')
      const planoGerado = await gerarPlanoEstudo(simuladoResult)
      setPlano(planoGerado)
    } catch (err) {
      console.error('Erro ao gerar plano:', err)
      setError('Erro ao gerar plano de estudos. Verifique a chave da API.')
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleCloseResult = useCallback(() => {
    setResult(null)
    setPlano(null)
    setSelectedQuestions(new Set())
    setError(null)
  }, [])

  const toggleQuestion = useCallback((questionNumber: number) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionNumber)) {
        next.delete(questionNumber)
      } else {
        next.add(questionNumber)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!result) return
    setSelectedQuestions(new Set(result.wrongQuestions.map(q => q.questionNumber)))
  }, [result])

  const deselectAll = useCallback(() => {
    setSelectedQuestions(new Set())
  }, [])

  const selectedQuestionsList = useMemo(() => {
    if (!result) return []
    return result.wrongQuestions.filter(q => selectedQuestions.has(q.questionNumber))
  }, [result, selectedQuestions])

  const getAvailableSlots = useCallback((): Array<{
    dia: DiaSemana
    turno: Turno
    slotIndex: number
    inicio: string
    fim: string
  }> => {
    const available: Array<{
      dia: DiaSemana
      turno: Turno
      slotIndex: number
      inicio: string
      fim: string
    }> = []

    for (const dia of DIAS_SEMANA) {
      for (const turno of TURNOS) {
        const slots = TURNOS_CONFIG[turno].slots

        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]

          const isOfficial = officialSchedule.some(
            (h) =>
              h.diaSemana === dia &&
              h.turno === turno &&
              h.horarioInicio === slot.inicio
          )

          const hasBlock = blocks.some(
            (b) =>
              b.diaSemana === dia &&
              b.turno === turno &&
              b.horarioInicio === slot.inicio
          )

          if (!isOfficial && !hasBlock) {
            available.push({
              dia,
              turno,
              slotIndex: i,
              inicio: slot.inicio,
              fim: slot.fim,
            })
          }
        }
      }
    }

    return available
  }, [blocks, officialSchedule])

  const handleDistribute = async () => {
    if (!result || !currentStudent || selectedQuestionsList.length === 0) return

    try {
      const activeCronograma = cronograma ?? await createCronogramaForStudent()
      const availableSlots = getAvailableSlots()
      const questionsToDistribute = selectedQuestionsList.slice(0, availableSlots.length)

      for (let index = 0; index < questionsToDistribute.length; index++) {
        const question = questionsToDistribute[index]
        const slot = availableSlots[index]
        if (!slot) continue

        await createBlock(activeCronograma.id, question, slot)
      }

      handleCloseResult()
    } catch (err) {
      console.error('Failed to distribute blocks:', err)
      setError('Erro ao distribuir blocos')
    }
  }

  const createCronogramaForStudent = async () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    if (!currentStudent) throw new Error('Nenhum aluno selecionado')
    return createCronograma(currentStudent.id, weekStart, weekEnd)
  }

  const createBlock = async (
    cronogramaId: string,
    question: WrongQuestion,
    slot: { dia: DiaSemana; turno: Turno; inicio: string; fim: string }
  ) => {
    const areaColor = getColorFromQuestionNumber(question.questionNumber)

    const blockData: Omit<BlocoCronograma, 'id' | 'createdAt'> = {
      cronogramaId,
      diaSemana: slot.dia,
      turno: slot.turno,
      horarioInicio: slot.inicio,
      horarioFim: slot.fim,
      tipo: 'revisao',
      titulo: question.topic,
      descricao: `Questão ${question.questionNumber} - Revisão de erro`,
      disciplinaCodigo: null,
      cor: areaColor,
      prioridade: 1, // Prioridade alta para questões erradas individuais
      concluido: false,
    }

    await addBlock(blockData)
  }

  if (!result && !plano) {
    return (
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAnalyze}
          onMouseEnter={preloadAnalyzer}
          onFocus={preloadAnalyzer}
          isLoading={isLoading}
          variant="secondary"
          size="sm"
        >
          Analisar Simulado
        </Button>
        <Button
          onClick={handleGerarPlano}
          onMouseEnter={preloadAnalyzer}
          onFocus={preloadAnalyzer}
          isLoading={isGeneratingPlan}
          variant="outline"
          size="sm"
        >
          ✨ Plano IA
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    )
  }

  // Exibe apenas o plano IA (sem ter aberto o simulado completo)
  if (plano && !result) {
    return (
      <PlanoEstudoIA
        plano={plano}
        nomeAluno={currentStudent?.nome ?? null}
        simuladoTitle="Simulado"
        onClose={() => setPlano(null)}
      />
    )
  }

  if (!result) return null

  const totalQuestions = result.wrongQuestions.length
  const selectedCount = selectedQuestions.size
  const canDistribute = selectedCount > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{result.exam.title}</h3>
          <p className="text-sm text-gray-500">
            {result.studentAnswer.correct_answers} acertos •{' '}
            {result.studentAnswer.wrong_answers} erros •{' '}
            {result.studentAnswer.blank_answers} em branco
          </p>
          {/* Notas TRI por área - Cores padronizadas do sistema */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            {result.studentAnswer.tri_lc != null && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                <span className="text-gray-600">LC:</span>
                <span className="font-semibold text-gray-900">{result.studentAnswer.tri_lc.toFixed(1)}</span>
              </span>
            )}
            {result.studentAnswer.tri_ch != null && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
                <span className="text-gray-600">CH:</span>
                <span className="font-semibold text-gray-900">{result.studentAnswer.tri_ch.toFixed(1)}</span>
              </span>
            )}
            {result.studentAnswer.tri_cn != null && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                <span className="text-gray-600">CN:</span>
                <span className="font-semibold text-gray-900">{result.studentAnswer.tri_cn.toFixed(1)}</span>
              </span>
            )}
            {result.studentAnswer.tri_mt != null && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                <span className="text-gray-600">MT:</span>
                <span className="font-semibold text-gray-900">{result.studentAnswer.tri_mt.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCloseResult}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fechar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-4 gap-2">
        <ScoreBar label="LC" value={result.studentAnswer.tri_lc} />
        <ScoreBar label="CH" value={result.studentAnswer.tri_ch} />
        <ScoreBar label="CN" value={result.studentAnswer.tri_cn} />
        <ScoreBar label="MT" value={result.studentAnswer.tri_mt} />
      </div>

      {/* Questions selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Selecione as questões erradas para revisar
          </h4>
          <span className="text-xs text-gray-500">
            {selectedCount} de {totalQuestions} selecionadas
          </span>
        </div>

        {/* Select/Deselect all */}
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            type="button"
          >
            Selecionar todas
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={deselectAll}
            className="text-xs text-gray-500 hover:text-gray-700"
            type="button"
          >
            Limpar seleção
          </button>
        </div>

        {/* Questions list - grouped by area */}
        <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2 bg-gray-50">
          {/* Linguagens */}
          {renderQuestionGroup(
            result.wrongQuestions.filter(q => q.questionNumber >= 1 && q.questionNumber <= 45),
            'Linguagens',
            'bg-blue-50',
            selectedQuestions,
            toggleQuestion
          )}
          
          {/* Humanas */}
          {renderQuestionGroup(
            result.wrongQuestions.filter(q => q.questionNumber >= 46 && q.questionNumber <= 90),
            'Humanas',
            'bg-orange-50',
            selectedQuestions,
            toggleQuestion
          )}
          
          {/* Natureza */}
          {renderQuestionGroup(
            result.wrongQuestions.filter(q => q.questionNumber >= 91 && q.questionNumber <= 135),
            'Natureza',
            'bg-green-50',
            selectedQuestions,
            toggleQuestion
          )}
          
          {/* Matemática */}
          {renderQuestionGroup(
            result.wrongQuestions.filter(q => q.questionNumber >= 136 && q.questionNumber <= 180),
            'Matemática',
            'bg-red-50',
            selectedQuestions,
            toggleQuestion
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className={`text-sm ${canDistribute ? 'text-gray-600' : 'text-red-500'}`}>
          {canDistribute
            ? `${selectedCount} questão${selectedCount > 1 ? 's' : ''} serão adicionadas`
            : 'Selecione pelo menos uma questão'}
        </span>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarPlano}
            isLoading={isGeneratingPlan}
          >
            ✨ Plano IA
          </Button>
          <Button variant="secondary" onClick={handleCloseResult}>
            Cancelar
          </Button>
          <Button onClick={handleDistribute} disabled={!canDistribute}>
            Distribuir {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Plano IA (exibido dentro do card quando gerado com simulado aberto) */}
      {plano && (
        <div className="pt-2 border-t border-gray-100">
          <PlanoEstudoIA
            plano={plano}
            nomeAluno={result.studentAnswer.student_name}
            simuladoTitle={result.exam.title}
            onClose={() => setPlano(null)}
          />
        </div>
      )}
    </div>
  )
}

// Helper function to render question groups
function renderQuestionGroup(
  questions: WrongQuestion[],
  areaName: string,
  headerBgClass: string,
  selectedQuestions: Set<number>,
  onToggle: (qNum: number) => void
) {
  if (questions.length === 0) return null

  return (
    <div className="space-y-1">
      <div className={`px-3 py-2 rounded-md font-medium text-sm ${headerBgClass} text-gray-700`}>
        {areaName} ({questions.length} questões)
      </div>
      <div className="space-y-1 pl-2">
        {questions.map((question) => (
          <QuestionItem
            key={question.questionNumber}
            question={question}
            isSelected={selectedQuestions.has(question.questionNumber)}
            onToggle={() => onToggle(question.questionNumber)}
          />
        ))}
      </div>
    </div>
  )
}

// Sub-components

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  // Cores fixas por área (conforme padrão do sistema)
  const CORES_TRI: Record<string, string> = {
    'LC': '#3B82F6', // Azul - Linguagens
    'CH': '#F97316', // Laranja - Humanas
    'CN': '#10B981', // Verde - Natureza
    'MT': '#EF4444', // Vermelho - Matemática
  }
  
  const corArea = CORES_TRI[label] || '#6B7280'
  
  if (value == null) {
    return (
      <div className="text-center">
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden" />
        <div className="text-xs text-gray-400 mt-1">-</div>
      </div>
    )
  }
  
  const score = value
  const percentage = Math.min(100, Math.max(0, (score - 300) / 5))

  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: corArea }}
        />
      </div>
      <div className="text-xs font-semibold mt-1 text-gray-700">{score.toFixed(0)}</div>
    </div>
  )
}

type QuestionItemProps = {
  question: WrongQuestion
  isSelected: boolean
  onToggle: () => void
}

function QuestionItem({ question, isSelected, onToggle }: QuestionItemProps) {
  return (
    <label
      className={`flex items-center gap-3 py-2 px-3 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-transparent hover:bg-gray-100'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
      />
      <span className="flex-1 text-sm text-gray-700">
        {question.topic}
      </span>
      <span className="text-xs font-medium text-gray-400">
        Q{question.questionNumber}
      </span>
    </label>
  )
}
