import { useEffect, useMemo, useState } from 'react'
import type { CursoEscolhido, ReportData } from '../../types/report'
import type { SimuladoResult } from '../../types/supabase'
import type {
  ContentTopic,
  ExpectedLevel,
  MentorPlanItem,
  MentorPlanSummary,
} from '../../types/mentor-intelligence'
import {
  ReportHeader,
  SecaoResumo,
  SecaoInvestir,
  SecaoDesperdiciosTexto,
  SecaoAprovadosDetalhado,
  ReportLoadingSkeleton,
} from './report'
import { uploadPdf } from '../../services/pdf-storage'

interface RelatorioCirurgicoProps {
  readonly report: ReportData | null
  readonly nomeAluno: string
  readonly simulado?: SimuladoResult
  readonly student?: {
    id?: string | null
    matricula?: string | null
    escola?: string | null
    schoolId?: string | null
  }
  readonly isLoading?: boolean
  readonly loadingMessage?: string
  readonly onClose?: () => void
}

function formatExpectedLevel(level: ExpectedLevel): string {
  switch (level) {
    case 'recover':
      return 'Recuperar'
    case 'maintain':
      return 'Manter'
    case 'advance':
      return 'Avançar'
  }
}

function describeExpectedLevel(level: ExpectedLevel): string {
  switch (level) {
    case 'recover':
      return 'Entrar com reforço e base antes de subir o nível.'
    case 'maintain':
      return 'Seguir praticando para consolidar o conteúdo.'
    case 'advance':
      return 'Conteúdo já permite subir a exigência e aprofundar.'
  }
}

function formatPlanStatus(status: MentorPlanSummary['status']): string {
  switch (status) {
    case 'draft':
      return 'Rascunho em revisão'
    case 'sent':
      return 'Plano enviado'
    case 'superseded':
      return 'Plano substituído'
    case 'archived':
      return 'Plano arquivado'
  }
}

function buildPlanBaseText(plan: MentorPlanSummary): string {
  switch (plan.generationMode) {
    case 'preview_only':
      return 'Este rascunho foi montado só nesta tela e não ficou salvo no sistema.'
    case 'fallback_guided':
      return 'O sistema montou esta sugestão a partir das áreas e habilidades do relatório.'
    case 'hybrid':
      return 'O sistema misturou leitura semântica das questões com os sinais do relatório.'
    case 'taxonomy_complete':
      return 'O sistema conseguiu usar leitura semântica completa das questões erradas.'
  }
}

function buildCoverageText(plan: MentorPlanSummary): string {
  if (plan.coverageScore.totalPairs === 0) {
    return 'Não houve questões elegíveis para montar este plano.'
  }

  if (plan.coverageScore.mappedPairs === 0) {
    return 'Nenhuma questão errada deste simulado tinha leitura semântica disponível. O sistema usou os sinais do relatório para sugerir o plano.'
  }

  return `${plan.coverageScore.mappedPairs} de ${plan.coverageScore.totalPairs} questões erradas deste simulado já têm leitura semântica e ajudaram a montar esta sugestão.`
}

function getPlanItemTitle(item: MentorPlanItem): string {
  return item.topic?.canonicalLabel ?? item.fallbackLabel ?? 'Tópico sugerido'
}

function getPlanItemMeta(item: MentorPlanItem): string {
  if (item.topic) {
    return `${item.topic.areaSigla} · prioridade ${item.plannedOrder + 1}`
  }

  const parts = [item.fallbackAreaSigla]
  if (typeof item.fallbackHabilidade === 'number') {
    parts.push(`habilidade ${item.fallbackHabilidade}`)
  }

  return parts.filter(Boolean).join(' · ') || `prioridade ${item.plannedOrder + 1}`
}

export function RelatorioCirurgico({
  report,
  nomeAluno,
  simulado,
  student,
  isLoading = false,
  loadingMessage,
  onClose,
}: RelatorioCirurgicoProps) {
  const [isGeneratingRelatorio, setIsGeneratingRelatorio] = useState(false)
  const [isGeneratingQuestoes, setIsGeneratingQuestoes] = useState(false)
  const [isSavingMentorPlan, setIsSavingMentorPlan] = useState(false)
  const [isRefreshingMentorPlan, setIsRefreshingMentorPlan] = useState(false)
  const [isSendingMentorPlan, setIsSendingMentorPlan] = useState(false)
  const [isAddingTopic, setIsAddingTopic] = useState(false)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [mentorPlanFeedback, setMentorPlanFeedback] = useState<string | null>(null)
  const [mentorPlan, setMentorPlan] = useState<MentorPlanSummary | null>(null)
  const [availableTopics, setAvailableTopics] = useState<ReadonlyArray<ContentTopic>>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [selectedExpectedLevel, setSelectedExpectedLevel] =
    useState<ExpectedLevel>('recover')
  const sisuAnalysis = report?.sisuAnalysis ?? null
  const cursoSelecionado = useMemo<CursoEscolhido | null>(() => {
    if (!sisuAnalysis?.curso) return null

    return {
      nome: sisuAnalysis.curso.nome,
      universidade: sisuAnalysis.curso.universidade,
      estado: sisuAnalysis.curso.estado,
      modalidade: sisuAnalysis.nomeModalidade,
    }
  }, [sisuAnalysis])
  const cursoMentorLabel = sisuAnalysis?.curso
    ? [
        `${sisuAnalysis.curso.nome} — ${sisuAnalysis.curso.universidade}`,
        sisuAnalysis.curso.campus ? `(${sisuAnalysis.curso.campus})` : null,
        sisuAnalysis.curso.estado ? sisuAnalysis.curso.estado : null,
      ]
        .filter(Boolean)
        .join(' ')
    : 'curso não identificado'
  const mentorPlanIsEditable = Boolean(
    mentorPlan && !mentorPlan.isPreviewOnly && mentorPlan.status === 'draft',
  )
  const availableTopicsForPlan = useMemo(() => {
    const usedTopics = new Set(
      (mentorPlan?.items ?? [])
        .map((item) => item.topicId)
        .filter((topicId): topicId is string => Boolean(topicId)),
    )

    return availableTopics.filter((topic) => !usedTopics.has(topic.id))
  }, [availableTopics, mentorPlan?.items])

  useEffect(() => {
    if (!mentorPlanIsEditable) {
      return
    }

    let isCancelled = false

    void (async () => {
      try {
        const { loadContentTopics } = await import('../../services/mentor-intelligence')
        const topics = await loadContentTopics()
        if (isCancelled) return
        setAvailableTopics(topics)
      } catch (error) {
        if (isCancelled) return
        console.error('Erro ao carregar tópicos canônicos:', error)
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [mentorPlanIsEditable])

  useEffect(() => {
    if (!selectedTopicId && availableTopicsForPlan.length > 0) {
      setSelectedTopicId(availableTopicsForPlan[0].id)
    }

    if (selectedTopicId && !availableTopicsForPlan.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(availableTopicsForPlan[0]?.id ?? '')
    }
  }, [availableTopicsForPlan, selectedTopicId])

  const refreshMentorPlan = async (planId: string) => {
    setIsRefreshingMentorPlan(true)

    try {
      const { loadMentorPlan } = await import('../../services/mentor-intelligence')
      const refreshedPlan = await loadMentorPlan(planId)
      setMentorPlan(refreshedPlan)
      return refreshedPlan
    } finally {
      setIsRefreshingMentorPlan(false)
    }
  }

  if (isLoading) {
    return <ReportLoadingSkeleton message={loadingMessage} onClose={onClose} />
  }

  if (!report || !sisuAnalysis) {
    return (
      <div className="bg-white rounded-xl border border-[#e3e2e0] p-8 text-center">
        <p className="text-[13px] text-[#9ca3af]">
          Nenhum dado disponivel para gerar o relatorio.
        </p>
      </div>
    )
  }

  const saveGeneratedPdf = async (params: {
    blob: Blob
    filename: string
    tipo: 'relatorio' | 'caderno_questoes'
  }) => {
    if (!student?.id || !student?.matricula) {
      return
    }

    try {
      await uploadPdf({
        blob: params.blob,
        filename: params.filename,
        schoolId: student.schoolId ?? null,
        schoolName: student.escola ?? null,
        alunoId: student.id,
        alunoNome: nomeAluno,
        matricula: student.matricula,
        tipo: params.tipo,
      })
    } catch (err) {
      console.warn('[relatorio-cirurgico] Falha ao registrar PDF:', err)
    }
  }

  const handleDownloadRelatorio = async () => {
    setIsGeneratingRelatorio(true)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { RelatorioCirurgicoPDF } = await import('../pdf/relatorio-cirurgico-pdf')
      const doc = createElement(RelatorioCirurgicoPDF, {
        report,
        nomeAluno,
        simulado,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob()
      const url = URL.createObjectURL(blob)
      const filename = `relatorio-desempenho-${nomeAluno.toLowerCase().replace(/\s+/g, '-')}.pdf`
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      void saveGeneratedPdf({ blob, filename, tipo: 'relatorio' })
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF do relatorio:', err)
    } finally {
      setIsGeneratingRelatorio(false)
    }
  }

  const handleDownloadQuestoes = async () => {
    setIsGeneratingQuestoes(true)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { QuestoesRecomendadasPDF } = await import('../pdf/questoes-recomendadas-pdf')
      const effectiveReport = simulado && cursoSelecionado
        ? await import('../../services/report-engine').then(({ computeReportData }) =>
          computeReportData(simulado, cursoSelecionado),
        )
        : report
      const { loadQuestionImageLayouts } = await import('../../services/question-image-layout')
      const imageLayoutByQuestionKey = await loadQuestionImageLayouts(effectiveReport)
      const doc = createElement(QuestoesRecomendadasPDF, {
        report: effectiveReport,
        nomeAluno,
        imageLayoutByQuestionKey,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob()
      const url = URL.createObjectURL(blob)
      const filename = `caderno-questoes-${nomeAluno.toLowerCase().replace(/\s+/g, '-')}.pdf`
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      void saveGeneratedPdf({ blob, filename, tipo: 'caderno_questoes' })
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF de questoes:', err)
    } finally {
      setIsGeneratingQuestoes(false)
    }
  }

  const handleCreateMentorPlan = async () => {
    if (!simulado) return

    setIsSavingMentorPlan(true)
    setMentorPlanFeedback(null)

    try {
      const {
        createDraftMentorPlanFromSimulado,
        describeMentorPlanGeneration,
      } = await import('../../services/mentor-intelligence')
      const plan = await createDraftMentorPlanFromSimulado({
        simulado,
        report,
        student: {
          id: student?.id ?? null,
          matricula: student?.matricula ?? null,
          escola: student?.escola ?? null,
        },
        notes: `Plano sugerido pelo relatório cirúrgico para ${cursoMentorLabel}.`,
      })
      setMentorPlan(plan)

      setMentorPlanFeedback(
        `${describeMentorPlanGeneration({
          generationMode: plan.generationMode,
          taxonomySourceKind: plan.taxonomySourceKind,
        })} · semana de ${new Date(plan.weekStart).toLocaleDateString('pt-BR')} · cobertura ${plan.coverageScore.coveragePercent.toFixed(1)}%.`,
      )
    } catch (err) {
      console.error('Erro ao criar plano do mentor:', err)
      setMentorPlanFeedback(
        err instanceof Error
          ? err.message
          : 'Erro ao criar o plano do mentor a partir do relatório.',
      )
    } finally {
      setIsSavingMentorPlan(false)
    }
  }

  const handleUpdatePlanItemLevel = async (
    item: MentorPlanItem,
    nextLevel: ExpectedLevel,
  ) => {
    if (!mentorPlan || mentorPlan.isPreviewOnly || mentorPlan.status !== 'draft') {
      return
    }

    setPendingItemId(item.id)
    setMentorPlanFeedback(null)

    try {
      const { updateMentorPlanItem } = await import('../../services/mentor-intelligence')
      await updateMentorPlanItem(item.id, {
        expectedLevel: nextLevel,
        notes: item.notes,
      })
      await refreshMentorPlan(mentorPlan.id)
    } catch (error) {
      console.error('Erro ao atualizar item do plano:', error)
      setMentorPlanFeedback(
        error instanceof Error
          ? error.message
          : 'Erro ao atualizar o foco pedagógico deste tópico.',
      )
    } finally {
      setPendingItemId(null)
    }
  }

  const handleRemovePlanItem = async (itemId: string) => {
    if (!mentorPlan || mentorPlan.isPreviewOnly || mentorPlan.status !== 'draft') {
      return
    }

    setPendingItemId(itemId)
    setMentorPlanFeedback(null)

    try {
      const { deleteMentorPlanItem } = await import('../../services/mentor-intelligence')
      await deleteMentorPlanItem(itemId)
      await refreshMentorPlan(mentorPlan.id)
    } catch (error) {
      console.error('Erro ao remover item do plano:', error)
      setMentorPlanFeedback(
        error instanceof Error
          ? error.message
          : 'Erro ao remover este tópico do plano.',
      )
    } finally {
      setPendingItemId(null)
    }
  }

  const handleAddManualTopic = async () => {
    if (!mentorPlan || mentorPlan.isPreviewOnly || mentorPlan.status !== 'draft' || !selectedTopicId) {
      return
    }

    setIsAddingTopic(true)
    setMentorPlanFeedback(null)

    try {
      const { addMentorPlanItem } = await import('../../services/mentor-intelligence')
      await addMentorPlanItem({
        mentorPlanId: mentorPlan.id,
        topicId: selectedTopicId,
        expectedLevel: selectedExpectedLevel,
      })
      const refreshedPlan = await refreshMentorPlan(mentorPlan.id)
      setMentorPlanFeedback('Tópico adicionado ao rascunho da semana.')
      const remainingTopics = availableTopics.filter((topic) =>
        !refreshedPlan.items.some((item) => item.topicId === topic.id),
      )
      setSelectedTopicId(remainingTopics[0]?.id ?? '')
    } catch (error) {
      console.error('Erro ao adicionar tópico no plano:', error)
      setMentorPlanFeedback(
        error instanceof Error
          ? error.message
          : 'Erro ao adicionar tópico manualmente ao plano.',
      )
    } finally {
      setIsAddingTopic(false)
    }
  }

  const handleSendMentorPlan = async () => {
    if (!mentorPlan || mentorPlan.isPreviewOnly || mentorPlan.status !== 'draft') {
      return
    }

    setIsSendingMentorPlan(true)
    setMentorPlanFeedback(null)

    try {
      const { sendMentorPlan } = await import('../../services/mentor-intelligence')
      await sendMentorPlan(mentorPlan.id)
      const refreshedPlan = await refreshMentorPlan(mentorPlan.id)
      setMentorPlanFeedback(
        `Plano confirmado para a semana de ${new Date(refreshedPlan.weekStart).toLocaleDateString('pt-BR')} e pronto para orientar o cronograma deste aluno.`,
      )
    } catch (error) {
      console.error('Erro ao enviar plano do mentor:', error)
      setMentorPlanFeedback(
        error instanceof Error
          ? error.message
          : 'Erro ao confirmar o plano da semana.',
      )
    } finally {
      setIsSendingMentorPlan(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e3e2e0] overflow-hidden">
      {/* Header */}
      <div className="relative">
        <ReportHeader
          nomeAluno={nomeAluno}
          curso={sisuAnalysis.curso}
          notaCorte={sisuAnalysis.notaCorte}
          gap={sisuAnalysis.gap}
          computedAt={report.computedAt}
          onDownloadRelatorio={handleDownloadRelatorio}
          onDownloadQuestoes={handleDownloadQuestoes}
          isGeneratingRelatorio={isGeneratingRelatorio}
          isGeneratingQuestoes={isGeneratingQuestoes}
        />
        {onClose ? (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="px-5 py-4 space-y-6">
        {simulado ? (
          <div className="rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                    Sessão do mentor
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[#0f172a]">
                    Plano da semana com o aluno
                  </h3>
                  <p className="mt-1 text-sm text-[#475569]">
                    Use este bloco para transformar os erros do último simulado em um plano simples:
                    monte a sugestão, ajuste o foco de cada tópico e confirme quando estiver pronto
                    para virar base do cronograma.
                  </p>
                </div>
                {!mentorPlan ? (
                  <button
                    onClick={() => void handleCreateMentorPlan()}
                    disabled={isSavingMentorPlan}
                    className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isSavingMentorPlan ? 'Montando plano...' : 'Montar plano da semana'}
                  </button>
                ) : null}
              </div>

              {mentorPlan ? (
                <div className="rounded-2xl border border-[#d9e6fb] bg-white px-4 py-4">
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div className="rounded-2xl border border-[#e2e8f0] bg-[#fbfdff] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                          Como usar nesta reunião
                        </p>
                        <ol className="mt-2 space-y-2 text-sm text-[#334155]">
                          <li>1. Confira se os tópicos sugeridos combinam com o que o aluno errou.</li>
                          <li>2. Ajuste o foco para recuperar, manter ou avançar.</li>
                          <li>3. Quando estiver satisfeito, confirme o plano e siga para o cronograma.</li>
                        </ol>
                      </div>

                      <div className="rounded-2xl border border-[#e2e8f0] bg-[#fbfdff] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                          Leitura usada
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#0f172a]">
                          {formatPlanStatus(mentorPlan.status)}
                        </p>
                        <p className="mt-1 text-sm text-[#475569]">
                          {buildPlanBaseText(mentorPlan)}
                        </p>
                        <p className="mt-2 text-sm text-[#475569]">
                          {buildCoverageText(mentorPlan)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
                      <span className="rounded-full border border-[#dbe5f3] bg-[#f8fbff] px-3 py-1 font-medium text-[#1d4ed8]">
                        Semana de {new Date(mentorPlan.weekStart).toLocaleDateString('pt-BR')} a{' '}
                        {new Date(mentorPlan.weekEnd).toLocaleDateString('pt-BR')}
                      </span>
                      {mentorPlan.taxonomySourceKind !== 'none' ? (
                        <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1">
                          Base ativa: {mentorPlan.taxonomySourceKind === 'homologation'
                            ? 'Homologação'
                            : mentorPlan.taxonomySourceKind === 'production'
                              ? 'Produção'
                              : 'Homologação + Produção'}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1">
                        {mentorPlan.items.length} tópico(s) na sugestão
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                            Rascunho da semana
                          </p>
                          <p className="mt-1 text-sm text-[#475569]">
                            Ajuste o foco de cada tópico antes de confirmar o plano.
                          </p>
                        </div>
                        {mentorPlan.status === 'draft' && !mentorPlan.isPreviewOnly ? (
                          <button
                            onClick={() => void handleSendMentorPlan()}
                            disabled={isSendingMentorPlan || mentorPlan.items.length === 0}
                            className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {isSendingMentorPlan
                              ? 'Confirmando plano...'
                              : 'Confirmar e enviar plano'}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-3">
                        {mentorPlan.items.length > 0 ? (
                          mentorPlan.items.map((item) => {
                            const isItemPending = pendingItemId === item.id || isRefreshingMentorPlan
                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[#0f172a]">
                                      {getPlanItemTitle(item)}
                                    </p>
                                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[#94a3b8]">
                                      {getPlanItemMeta(item)}
                                    </p>
                                    <p className="mt-2 text-sm text-[#475569]">
                                      {describeExpectedLevel(item.expectedLevel)}
                                    </p>
                                    {item.notes ? (
                                      <p className="mt-2 text-xs text-[#64748b]">
                                        Observação: {item.notes}
                                      </p>
                                    ) : null}
                                  </div>

                                  {mentorPlanIsEditable ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <label className="text-xs font-medium text-[#64748b]">
                                        Foco
                                      </label>
                                      <select
                                        value={item.expectedLevel}
                                        onChange={(event) => {
                                          void handleUpdatePlanItemLevel(
                                            item,
                                            event.target.value as ExpectedLevel,
                                          )
                                        }}
                                        disabled={isItemPending}
                                        className="rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#0f172a] disabled:opacity-50"
                                      >
                                        <option value="recover">Recuperar</option>
                                        <option value="maintain">Manter</option>
                                        <option value="advance">Avançar</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => void handleRemovePlanItem(item.id)}
                                        disabled={isItemPending}
                                        className="rounded-xl border border-[#fecaca] bg-white px-3 py-2 text-sm font-semibold text-[#dc2626] disabled:opacity-50"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="rounded-full border border-[#dbe5f3] bg-[#f8fbff] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]">
                                      {formatExpectedLevel(item.expectedLevel)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#fbfdff] px-4 py-6 text-sm text-[#64748b]">
                            Nenhum tópico foi mantido no plano. Adicione manualmente os conteúdos
                            que precisam entrar antes de confirmar.
                          </div>
                        )}
                      </div>
                    </div>

                    {mentorPlanIsEditable ? (
                      <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#fbfdff] px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                          Adição manual
                        </p>
                        <p className="mt-1 text-sm text-[#475569]">
                          Use só quando você quiser incluir um tópico que o sistema não puxou sozinho.
                        </p>

                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto]">
                          <select
                            value={selectedTopicId}
                            onChange={(event) => setSelectedTopicId(event.target.value)}
                            disabled={availableTopicsForPlan.length === 0 || isAddingTopic}
                            className="rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#0f172a] disabled:opacity-50"
                          >
                            {availableTopicsForPlan.length === 0 ? (
                              <option value="">
                                Não há mais tópicos ativos disponíveis para adicionar
                              </option>
                            ) : null}
                            {availableTopicsForPlan.map((topic) => (
                              <option key={topic.id} value={topic.id}>
                                {topic.areaSigla} · {topic.canonicalLabel}
                              </option>
                            ))}
                          </select>

                          <select
                            value={selectedExpectedLevel}
                            onChange={(event) =>
                              setSelectedExpectedLevel(event.target.value as ExpectedLevel)
                            }
                            disabled={availableTopicsForPlan.length === 0 || isAddingTopic}
                            className="rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#0f172a] disabled:opacity-50"
                          >
                            <option value="recover">Recuperar</option>
                            <option value="maintain">Manter</option>
                            <option value="advance">Avançar</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => void handleAddManualTopic()}
                            disabled={!selectedTopicId || isAddingTopic}
                            className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] disabled:opacity-50"
                          >
                            {isAddingTopic ? 'Adicionando...' : 'Adicionar tópico'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {mentorPlan.isPreviewOnly ? (
                      <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                        Este rascunho não foi salvo no sistema. Use-o só como apoio visual nesta
                        reunião até o módulo do mentor ficar disponível neste ambiente.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {mentorPlanFeedback ? (
              <p className="mt-3 text-xs text-[#1d4ed8]">
                {mentorPlanFeedback}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Secao 1: Resumo + Desempenho */}
        <SecaoResumo
          sisu={sisuAnalysis}
          mapaHabilidades={report.mapaHabilidades}
          simulado={simulado}
        />

        <div className="border-t border-[#e3e2e0]" />

        {/* Secao 2: Onde Investir */}
        <SecaoInvestir
          habilidades={report.questoesRecomendadas.habilidadesCriticas}
          sisu={sisuAnalysis}
          simulado={simulado}
        />

        <div className="border-t border-[#e3e2e0]" />

        {/* Secao 3: Questoes que Mais Custaram (TRI) */}
        <SecaoDesperdiciosTexto
          parametrosTRI={report.parametrosTRI}
          mapaHabilidades={report.mapaHabilidades}
          simulado={simulado}
          sisu={sisuAnalysis}
        />

        <div className="border-t border-[#e3e2e0]" />

        {/* Secao 4: Perfil dos Aprovados */}
        {report.perfilAprovados ? (
          <SecaoAprovadosDetalhado
            perfil={report.perfilAprovados}
            notaAtual={sisuAnalysis.notaPonderadaAtual}
          />
        ) : null}

        {/* Footer */}
        <p className="text-[10px] text-[#c1c0bb] text-center pb-1">
          Relatorio de Desempenho gerado pelo XTRI · xtri.online · Dados reais do Supabase ·{' '}
          {new Date(report.computedAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  )
}
