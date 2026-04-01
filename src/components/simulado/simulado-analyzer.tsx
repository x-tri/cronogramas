import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button'
import type {
  SimuladoHistoryItem,
  SimuladoResult,
  WrongQuestion,
} from '../../types/supabase'
import type { BlocoCronograma, DiaSemana, Turno } from '../../types/domain'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, TURNOS } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { getColorFromQuestionNumber } from '../../constants/colors'
import type { StudyReport } from '../../services/study-report'
import { StudyReportPanel } from './study-report-panel'
import {
  SisuGoalSelector,
  type GoalCourseCutoff,
  type GoalSelection,
} from './sisu-goal-selector'

type SimuladoAnalyzerProps = {
  matricula: string
  variant?: 'default' | 'compact'
}

type LoadResultOptions = {
  openModal?: boolean
}

function formatHistoryDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function SimuladoAnalyzer({
  matricula,
  variant = 'default',
}: SimuladoAnalyzerProps) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingResult, setIsLoadingResult] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isResultOpen, setIsResultOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<StudyReport | null>(null)
  const [goalSelection, setGoalSelection] = useState<GoalSelection | null>(null)
  const [goalCutoff, setGoalCutoff] = useState<GoalCourseCutoff | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())

  const blocks = useCronogramaStore((state) => state.blocks)
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const addBlock = useCronogramaStore((state) => state.addBlock)
  const cronograma = useCronogramaStore((state) => state.cronograma)
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const createCronograma = useCronogramaStore((state) => state.createCronograma)
  const simuladoHistory = useCronogramaStore((state) => state.simuladoHistory)
  const selectedSimuladoHistoryItem = useCronogramaStore(
    (state) => state.selectedSimuladoHistoryItem,
  )
  const selectedSimuladoResult = useCronogramaStore(
    (state) => state.selectedSimuladoResult,
  )
  const setSimuladoHistory = useCronogramaStore((state) => state.setSimuladoHistory)
  const setSelectedSimuladoHistoryItem = useCronogramaStore(
    (state) => state.setSelectedSimuladoHistoryItem,
  )
  const setSelectedSimuladoResult = useCronogramaStore(
    (state) => state.setSelectedSimuladoResult,
  )
  const resetSimuladoState = useCronogramaStore((state) => state.resetSimuladoState)

  const preloadAnalyzer = () => {
    void import('../../services/simulado-analyzer')
  }

  const openResultModal = useCallback((result: SimuladoResult) => {
    setSelectedQuestions(
      new Set(result.wrongQuestions.map((question) => question.questionNumber)),
    )
    setReport(null)
    setIsResultOpen(true)
  }, [])

  const loadHistory = useCallback(async (): Promise<SimuladoHistoryItem[]> => {
    setIsLoadingHistory(true)
    setError(null)

    try {
      const { listStudentSimulados } = await import('../../services/simulado-analyzer')
      const history = await listStudentSimulados(matricula)
      setSimuladoHistory(history)

      if (history.length === 0) {
        setSelectedSimuladoHistoryItem(null)
        setSelectedSimuladoResult(null)
        return []
      }

      setSelectedSimuladoHistoryItem(history[0])
      setSelectedSimuladoResult(null)

      return history
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar histórico de simulados')
      setSimuladoHistory([])
      setSelectedSimuladoHistoryItem(null)
      setSelectedSimuladoResult(null)
      return []
    } finally {
      setIsLoadingHistory(false)
    }
  }, [
    matricula,
    setSelectedSimuladoHistoryItem,
    setSelectedSimuladoResult,
    setSimuladoHistory,
  ])

  const loadResult = useCallback(
    async (
      item: SimuladoHistoryItem,
      options?: LoadResultOptions,
    ): Promise<SimuladoResult | null> => {
      setIsLoadingResult(true)
      setError(null)
      setSelectedSimuladoHistoryItem(item)

      try {
        const { getSimuladoResultByHistoryItem } = await import(
          '../../services/simulado-analyzer'
        )
        const result = await getSimuladoResultByHistoryItem(item)

        if (!result) {
          setError('Nenhum simulado encontrado para este aluno')
          setSelectedSimuladoResult(null)
          return null
        }

        setSelectedSimuladoResult(result)
        if (options?.openModal) {
          openResultModal(result)
        }
        return result
      } catch (err) {
        console.error(err)
        setError('Erro ao analisar simulado')
        return null
      } finally {
        setIsLoadingResult(false)
      }
    },
    [openResultModal, setSelectedSimuladoHistoryItem, setSelectedSimuladoResult],
  )

  const ensureSelectedHistoryItem = useCallback(async () => {
    if (selectedSimuladoHistoryItem) {
      return selectedSimuladoHistoryItem
    }

    const history = simuladoHistory.length > 0 ? simuladoHistory : await loadHistory()
    return history[0] ?? null
  }, [loadHistory, selectedSimuladoHistoryItem, simuladoHistory])

  const ensureSelectedResult = useCallback(
    async (options?: LoadResultOptions) => {
      const item = await ensureSelectedHistoryItem()
      if (!item) {
        setError('Nenhum simulado encontrado para este aluno')
        return null
      }

      if (selectedSimuladoResult && selectedSimuladoHistoryItem?.id === item.id) {
        if (options?.openModal) {
          openResultModal(selectedSimuladoResult)
        }
        return selectedSimuladoResult
      }

      return loadResult(item, options)
    },
    [
      ensureSelectedHistoryItem,
      loadResult,
      openResultModal,
      selectedSimuladoHistoryItem?.id,
      selectedSimuladoResult,
    ],
  )

  useEffect(() => {
    let isCancelled = false

    setError(null)
    setReport(null)
    setGoalSelection(null)
    setGoalCutoff(null)
    setSelectedQuestions(new Set())
    setIsHistoryOpen(false)
    setIsResultOpen(false)
    resetSimuladoState()

    void (async () => {
      const history = await loadHistory()
      if (isCancelled || history.length === 0) {
        return
      }

      setSelectedSimuladoHistoryItem(history[0])
    })()

    return () => {
      isCancelled = true
    }
  }, [loadHistory, resetSimuladoState, setSelectedSimuladoHistoryItem])

  const handleAnalyze = async () => {
    await ensureSelectedResult({ openModal: true })
  }

  const handleSelectHistoryItem = async (item: SimuladoHistoryItem) => {
    setIsHistoryOpen(false)
    setSelectedSimuladoResult(null)
    await loadResult(item, { openModal: true })
  }

  const handleOpenStudyReport = async () => {
    setError(null)
    setReport(null)
    await ensureSelectedResult({ openModal: true })
  }

  const handleGenerateReport = async (courseId: number | null) => {
    setIsGeneratingReport(true)
    setError(null)
    setReport(null)

    try {
      const simuladoResult = await ensureSelectedResult()
      if (!simuladoResult) {
        setError('Nenhum simulado encontrado para gerar o relatório')
        return
      }

      const { gerarRelatorioEstudoPorObjetivo } = await import('../../services/study-report')
      const generatedReport = await gerarRelatorioEstudoPorObjetivo(simuladoResult, courseId ?? undefined)
      setReport(generatedReport)
      setIsResultOpen(false)
    } catch (err) {
      console.error('Erro ao gerar relatório de estudos:', err)
      setError('Erro ao gerar relatório de estudos por objetivo')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleCloseResult = useCallback(() => {
    setIsResultOpen(false)
    setReport(null)
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
    if (!selectedSimuladoResult) return
    setSelectedQuestions(
      new Set(selectedSimuladoResult.wrongQuestions.map((q) => q.questionNumber)),
    )
  }, [selectedSimuladoResult])

  const deselectAll = useCallback(() => {
    setSelectedQuestions(new Set())
  }, [])

  const selectedQuestionsList = useMemo(() => {
    if (!selectedSimuladoResult) return []
    return selectedSimuladoResult.wrongQuestions.filter((q) =>
      selectedQuestions.has(q.questionNumber),
    )
  }, [selectedSimuladoResult, selectedQuestions])

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
            (horario) =>
              horario.diaSemana === dia &&
              horario.turno === turno &&
              horario.horarioInicio === slot.inicio,
          )

          const hasBlock = blocks.some(
            (block) =>
              block.diaSemana === dia &&
              block.turno === turno &&
              block.horarioInicio === slot.inicio,
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
    slot: { dia: DiaSemana; turno: Turno; inicio: string; fim: string },
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
      prioridade: 1,
      concluido: false,
    }

    await addBlock(blockData)
  }

  const handleDistribute = async () => {
    if (!selectedSimuladoResult || !currentStudent || selectedQuestionsList.length === 0) {
      return
    }

    try {
      const activeCronograma = cronograma ?? (await createCronogramaForStudent())
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

  const renderModal = () => {
    const result = selectedSimuladoResult

    if (report && !isResultOpen) {
      return createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-4 pt-16 backdrop-blur-sm"
          onClick={() => setReport(null)}
        >
          <div
            className="animate-apple-scale-in max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5">
              <StudyReportPanel
                report={report}
                nomeAluno={currentStudent?.nome ?? null}
                simuladoTitle={
                  result?.exam.title ?? selectedSimuladoHistoryItem?.title ?? 'Simulado'
                }
                onClose={() => setReport(null)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )
    }

    if (!isResultOpen || !result) return null

    const totalQuestions = result.wrongQuestions.length
    const selectedCount = selectedQuestions.size
    const canDistribute = selectedCount > 0

    return createPortal(
      <div
        className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-4 pt-16 backdrop-blur-sm"
        onClick={handleCloseResult}
      >
        <div
          className="animate-apple-scale-in max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{result.exam.title}</h3>
                <p className="text-sm text-gray-500">
                  {result.studentAnswer.correct_answers} acertos •{' '}
                  {result.studentAnswer.wrong_answers} erros •{' '}
                  {result.studentAnswer.blank_answers} em branco
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {result.studentAnswer.tri_lc != null && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                      <span className="text-gray-600">LC:</span>
                      <span className="font-semibold text-gray-900">
                        {result.studentAnswer.tri_lc.toFixed(1)}
                      </span>
                    </span>
                  )}
                  {result.studentAnswer.tri_ch != null && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                      <span className="text-gray-600">CH:</span>
                      <span className="font-semibold text-gray-900">
                        {result.studentAnswer.tri_ch.toFixed(1)}
                      </span>
                    </span>
                  )}
                  {result.studentAnswer.tri_cn != null && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                      <span className="text-gray-600">CN:</span>
                      <span className="font-semibold text-gray-900">
                        {result.studentAnswer.tri_cn.toFixed(1)}
                      </span>
                    </span>
                  )}
                  {result.studentAnswer.tri_mt != null && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                      <span className="text-gray-600">MT:</span>
                      <span className="font-semibold text-gray-900">
                        {result.studentAnswer.tri_mt.toFixed(1)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleCloseResult}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <ScoreBar label="LC" value={result.studentAnswer.tri_lc} />
              <ScoreBar label="CH" value={result.studentAnswer.tri_ch} />
              <ScoreBar label="CN" value={result.studentAnswer.tri_cn} />
              <ScoreBar label="MT" value={result.studentAnswer.tri_mt} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">
                  Selecione as questões erradas para revisar
                </h4>
                <span className="text-xs text-gray-500">
                  {selectedCount} de {totalQuestions} selecionadas
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
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

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-2">
                {renderQuestionGroup(
                  result.wrongQuestions.filter(
                    (question) => question.questionNumber >= 1 && question.questionNumber <= 45,
                  ),
                  'Linguagens',
                  'bg-blue-50',
                  selectedQuestions,
                  toggleQuestion,
                )}
                {renderQuestionGroup(
                  result.wrongQuestions.filter(
                    (question) => question.questionNumber >= 46 && question.questionNumber <= 90,
                  ),
                  'Humanas',
                  'bg-orange-50',
                  selectedQuestions,
                  toggleQuestion,
                )}
                {renderQuestionGroup(
                  result.wrongQuestions.filter(
                    (question) =>
                      question.questionNumber >= 91 && question.questionNumber <= 135,
                  ),
                  'Natureza',
                  'bg-green-50',
                  selectedQuestions,
                  toggleQuestion,
                )}
                {renderQuestionGroup(
                  result.wrongQuestions.filter(
                    (question) =>
                      question.questionNumber >= 136 && question.questionNumber <= 180,
                  ),
                  'Matemática',
                  'bg-red-50',
                  selectedQuestions,
                  toggleQuestion,
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <SisuGoalSelector
                value={goalSelection}
                onChange={setGoalSelection}
                onCutoffChange={setGoalCutoff}
                onGenerate={(courseId) => void handleGenerateReport(courseId)}
                isGenerating={isGeneratingReport}
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className={`text-sm ${canDistribute ? 'text-gray-600' : 'text-red-500'}`}>
                {canDistribute
                  ? `${selectedCount} questão${selectedCount > 1 ? 's' : ''} pronta${selectedCount > 1 ? 's' : ''} para distribuição`
                  : 'Selecione pelo menos uma questão'}
              </span>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCloseResult}>
                  Fechar
                </Button>
                <Button onClick={handleDistribute} disabled={!canDistribute}>
                  Distribuir {selectedCount > 0 ? `(${selectedCount})` : ''}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const isBusy = isLoadingHistory || isLoadingResult
  const selectedHistoryLabel = selectedSimuladoHistoryItem
    ? `${selectedSimuladoHistoryItem.title} · ${formatHistoryDate(selectedSimuladoHistoryItem.date)}`
    : 'Nenhum simulado encontrado'
  const historyCountLabel =
    simuladoHistory.length > 0
      ? `${simuladoHistory.length} simulado${simuladoHistory.length > 1 ? 's' : ''}`
      : 'Sem histórico'
  const hasHistory = simuladoHistory.length > 0
  const isCompact = variant === 'compact'
  const hasGoalCutoff = goalCutoff?.notaCorteReferencia != null
  const goalCutoffHeadline = !goalSelection
    ? 'Análise geral (sem corte SISU)'
    : hasGoalCutoff
      ? `${goalCutoff?.origem === 'aprovados_final' ? 'Final Cut' : 'Corte'}: ${goalCutoff?.notaCorteReferencia?.toFixed(2)}`
      : 'Buscando corte do curso...'
  const goalCutoffDetail = hasGoalCutoff
    ? [
        goalCutoff?.ano != null ? `Ano ${goalCutoff.ano}` : null,
        goalCutoff?.menorNota != null && goalCutoff?.maiorNota != null
          ? `Maior/menor ${goalCutoff.maiorNota.toFixed(2)} · ${goalCutoff.menorNota.toFixed(2)}`
          : goalCutoff?.modalidade,
      ]
        .filter(Boolean)
        .join(' · ')
    : goalSelection?.courseLabel ?? 'Sem objetivo de curso selecionado'

  if (isCompact) {
    return (
      <>
        <div className="group relative min-w-0">
          <div className="flex h-12 overflow-hidden rounded-2xl border border-[#bfdbfe] bg-[#eff6ff]">
            <button
              onClick={handleAnalyze}
              onMouseEnter={preloadAnalyzer}
              onFocus={preloadAnalyzer}
              disabled={isBusy}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-4 text-left text-sm font-semibold text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] disabled:opacity-50"
              title={selectedHistoryLabel}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/80">
                {isLoadingResult ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-4m4 6H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">Simulado</span>
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((open) => !open)}
              onMouseEnter={preloadAnalyzer}
              onFocus={preloadAnalyzer}
              disabled={isBusy}
              aria-label="Selecionar simulado"
              className="inline-flex w-12 shrink-0 items-center justify-center border-l border-[#bfdbfe] text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-xl bg-[#0f172a] px-3 py-2 text-xs text-white opacity-0 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100">
            {hasHistory
              ? `${selectedHistoryLabel}. Abrir notas, erros e seleção de questões.`
              : 'Nenhum simulado relacionado para este aluno.'}
          </div>
        </div>

        <div className="group relative min-w-0">
          <button
            onClick={handleOpenStudyReport}
            onMouseEnter={preloadAnalyzer}
            onFocus={preloadAnalyzer}
            disabled={isGeneratingReport || isLoadingResult}
            className="inline-flex h-12 w-full items-center gap-2.5 rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] px-4 text-left text-sm font-semibold text-[#6d28d9] transition-colors hover:bg-[#ede9fe] disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              {isGeneratingReport ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                )}
              </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Plano SISU</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-[#7c3aed]">
                {goalCutoffHeadline}
              </span>
            </span>
          </button>
          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-xl bg-[#0f172a] px-3 py-2 text-xs text-white opacity-0 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100">
            {goalCutoffHeadline}. {goalCutoffDetail}.
          </div>
        </div>

        {isHistoryOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsHistoryOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-[#dbe5f3] bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#edf2f7] bg-[#f8fbff] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f]">Histórico de simulados</p>
                    <p className="truncate text-[11px] text-[#64748b]">{selectedHistoryLabel}</p>
                  </div>
                  <span className="rounded-full border border-[#dbe5f3] bg-white px-2 py-1 text-[10px] font-semibold text-[#475569]">
                    {historyCountLabel}
                  </span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto px-2 py-2">
                {isLoadingHistory ? (
                  <div className="px-3 py-6 text-center text-xs text-[#64748b]">
                    Carregando histórico...
                  </div>
                ) : simuladoHistory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-[#64748b]">
                    Nenhum simulado encontrado
                  </div>
                ) : (
                  simuladoHistory.map((item) => {
                    const isSelected = item.id === selectedSimuladoHistoryItem?.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleSelectHistoryItem(item)}
                        className={`flex w-full items-start justify-between rounded-xl px-3.5 py-3 text-left transition-all ${
                          isSelected
                            ? 'border border-[#cfe0ff] bg-[#f5f9ff] shadow-[0_12px_28px_-28px_rgba(37,99,235,0.8)]'
                            : 'border border-transparent hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1d1d1f]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#64748b]">
                            {formatHistoryDate(item.date)}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {item.isLatest && (
                            <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4f46e5]">
                              Mais recente
                            </span>
                          )}
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-[#2563eb]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
        {error &&
          createPortal(
            <div className="fixed left-1/2 top-14 z-[80] -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg">
              {error}
            </div>,
            document.body,
          )}
        {renderModal()}
      </>
    )
  }

  return (
    <>
      <div className="relative min-w-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">
                {selectedHistoryLabel}
              </p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                {hasHistory ? 'Simulado ativo' : 'Nenhum simulado relacionado'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
              {historyCountLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex min-w-[220px] flex-1 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
              <button
                onClick={handleAnalyze}
                onMouseEnter={preloadAnalyzer}
                onFocus={preloadAnalyzer}
                disabled={isBusy}
                className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white disabled:opacity-50"
                title={selectedHistoryLabel}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2563eb]">
                  {isLoadingResult ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 17v-6a2 2 0 012-2h8M9 17l3 3m-3-3l3-3M5 5h14"
                      />
                    </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#111827]">
                  Simulado
                </span>
                <span className="mt-0.5 block text-xs text-[#94a3b8]">
                  Resultado e erros
                </span>
              </span>
            </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen((open) => !open)}
                onMouseEnter={preloadAnalyzer}
                onFocus={preloadAnalyzer}
                disabled={isBusy}
                aria-label="Selecionar simulado"
                className="inline-flex w-12 shrink-0 items-center justify-center border-l border-[#e2e8f0] text-[#64748b] transition-colors hover:bg-white hover:text-[#1d4ed8] disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            <button
              onClick={handleOpenStudyReport}
              onMouseEnter={preloadAnalyzer}
              onFocus={preloadAnalyzer}
              disabled={isGeneratingReport || isLoadingResult}
              className="inline-flex min-h-[54px] min-w-[132px] flex-1 items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-3.5 py-3 text-left text-[#334155] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f8fafc] text-[#4f46e5]">
                {isGeneratingReport ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#111827]">Plano SISU</span>
                <span className="mt-0.5 block truncate text-xs text-[#94a3b8]">
                  {goalCutoffHeadline}
                </span>
              </span>
            </button>
          </div>
        </div>

        {isHistoryOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsHistoryOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-[#dbe5f3] bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
              <div className="border-b border-[#edf2f7] bg-[#f8fbff] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f]">Histórico de simulados</p>
                    <p className="truncate text-[11px] text-[#64748b]">{selectedHistoryLabel}</p>
                  </div>
                  <span className="rounded-full border border-[#dbe5f3] bg-white px-2 py-1 text-[10px] font-semibold text-[#475569]">
                    {historyCountLabel}
                  </span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto px-2 py-2">
                {isLoadingHistory ? (
                  <div className="px-3 py-6 text-center text-xs text-[#64748b]">
                    Carregando histórico...
                  </div>
                ) : simuladoHistory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-[#64748b]">
                    Nenhum simulado encontrado
                  </div>
                ) : (
                  simuladoHistory.map((item) => {
                    const isSelected = item.id === selectedSimuladoHistoryItem?.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleSelectHistoryItem(item)}
                        className={`flex w-full items-start justify-between rounded-xl px-3.5 py-3 text-left transition-all ${
                          isSelected
                            ? 'border border-[#cfe0ff] bg-[#f5f9ff] shadow-[0_12px_28px_-28px_rgba(37,99,235,0.8)]'
                            : 'border border-transparent hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1d1d1f]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#64748b]">
                            {formatHistoryDate(item.date)}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {item.isLatest && (
                            <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4f46e5]">
                              Mais recente
                            </span>
                          )}
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-[#2563eb]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {error &&
        createPortal(
          <div className="fixed left-1/2 top-14 z-[80] -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg">
            {error}
          </div>,
          document.body,
        )}
      {renderModal()}
    </>
  )
}

function renderQuestionGroup(
  questions: WrongQuestion[],
  areaName: string,
  headerBgClass: string,
  selectedQuestions: Set<number>,
  onToggle: (questionNumber: number) => void,
) {
  if (questions.length === 0) return null

  return (
    <div className="space-y-1">
      <div className={`rounded-md px-3 py-2 text-sm font-medium text-gray-700 ${headerBgClass}`}>
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

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const areaColors: Record<string, string> = {
    LC: '#3B82F6',
    CH: '#F97316',
    CN: '#10B981',
    MT: '#EF4444',
  }

  const areaColor = areaColors[label] || '#6B7280'

  if (value == null) {
    return (
      <div className="text-center">
        <div className="mb-1 text-xs text-gray-500">{label}</div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" />
        <div className="mt-1 text-xs text-gray-400">-</div>
      </div>
    )
  }

  const percentage = Math.min(100, Math.max(0, (value - 300) / 5))

  return (
    <div className="text-center">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: areaColor }}
        />
      </div>
      <div className="mt-1 text-xs font-semibold text-gray-700">{value.toFixed(0)}</div>
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
      className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 transition-colors ${
        isSelected
          ? 'border border-blue-200 bg-blue-50'
          : 'border border-transparent bg-white hover:bg-gray-100'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900">Questão {question.questionNumber}</div>
        <div className="truncate text-xs text-gray-500">{question.topic}</div>
      </div>
    </label>
  )
}
