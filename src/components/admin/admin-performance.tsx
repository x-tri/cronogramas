import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  addMentorPlanItem,
  buildMentorPlanItemLabel,
  describeCoverageState,
  describeMentorPlanGeneration,
  describeTaxonomySourceKind,
  loadContentTopics,
  loadMentorEnvironmentStatus,
  loadMentorPerformanceDetail,
  loadPerformanceOverview,
  sendMentorPlan,
  submitMentorAlertFeedback,
  type PerformanceOverviewItem,
  updateMentorPlanItem,
  deleteMentorPlanItem,
} from '../../services/mentor-intelligence'
import type {
  ContentTopic,
  MentorEnvironmentStatus,
  MentorAlert,
  MentorPlanSummary,
  StudentPerformanceAudit,
} from '../../types/mentor-intelligence'

type School = {
  readonly id: string
  readonly name: string
}

type DetailState = {
  readonly summary: PerformanceOverviewItem | null
  readonly plan: MentorPlanSummary
  readonly audit: StudentPerformanceAudit
}

interface AdminPerformanceProps {
  onBack?: () => void
  embedded?: boolean
  userRole?: string | null
  userSchoolId?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  verde: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amarelo: 'bg-amber-50 text-amber-700 border-amber-200',
  vermelho: 'bg-rose-50 text-rose-700 border-rose-200',
  sem_dados: 'bg-slate-100 text-slate-600 border-slate-200',
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg className="h-8 w-8 animate-spin text-[#2563eb]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR')
}

function relativeDate(date: string | null): string {
  if (!date) return 'sem análise'
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'agora'
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

function formatAttentionStatus(status: PerformanceOverviewItem['overallStatus']): string {
  switch (status) {
    case 'verde':
      return 'Tranquilo'
    case 'amarelo':
      return 'Atenção'
    case 'vermelho':
      return 'Crítico'
    case 'sem_dados':
      return 'Sem leitura suficiente'
  }
}

function formatExpectedLevel(value: 'recover' | 'maintain' | 'advance'): string {
  switch (value) {
    case 'recover':
      return 'Recuperar'
    case 'maintain':
      return 'Manter'
    case 'advance':
      return 'Avançar'
  }
}

function describeExpectedLevel(value: 'recover' | 'maintain' | 'advance'): string {
  switch (value) {
    case 'recover':
      return 'tema com lacuna clara e que deve entrar como prioridade de recuperação'
    case 'maintain':
      return 'tema que deve continuar na rotina, sem virar o foco principal'
    case 'advance':
      return 'tema em que o aluno já pode subir o nível ou ganhar complexidade'
  }
}

function buildNextActionText(detail: DetailState): string {
  if (detail.audit.overallStatus === 'vermelho') {
    return 'O plano precisa de intervenção. Revise os tópicos listados abaixo, ajuste a prioridade dos itens necessários e só depois envie.'
  }
  if (detail.audit.overallStatus === 'amarelo') {
    return 'O plano faz sentido, mas há pontos de atenção. Vale revisar os itens sugeridos antes de confirmar.'
  }
  if (detail.audit.overallStatus === 'sem_dados') {
    return 'O motor ainda não tem leitura suficiente para classificar o risco do aluno. Use este plano como rascunho: revise os tópicos, ajuste o que fizer sentido e envie apenas se concordar com a seleção.'
  }
  return 'O plano está coerente com os sinais disponíveis. Faça apenas ajustes finos, se necessário, e envie.'
}

function buildCoverageExplanation(detail: DetailState): string {
  if (detail.plan.coverageScore.coveragePercent <= 0) {
    return 'Ainda não há base semântica suficiente para este plano.'
  }

  return `${detail.plan.coverageScore.mappedPairs} de ${detail.plan.coverageScore.totalPairs} questões erradas deste caso já foram ligadas a tópicos canônicos.`
}

function SectionCard(props: {
  readonly title: string
  readonly value: number
  readonly className?: string
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${props.className ?? 'border-[#e5e7eb]'}`}>
      <p className="text-2xl font-semibold text-[#1d1d1f]">{props.value}</p>
      <p className="text-xs text-[#64748b]">{props.title}</p>
    </div>
  )
}

export function AdminPerformance({ onBack, embedded, userRole, userSchoolId }: AdminPerformanceProps) {
  const isCoordinator = userRole === 'coordinator' && !!userSchoolId
  const [items, setItems] = useState<PerformanceOverviewItem[]>([])
  const [topics, setTopics] = useState<ContentTopic[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchool, setSelectedSchool] = useState(isCoordinator ? userSchoolId! : '')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [environment, setEnvironment] = useState<MentorEnvironmentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [newTopicId, setNewTopicId] = useState('')
  const [newExpectedLevel, setNewExpectedLevel] = useState<'recover' | 'maintain' | 'advance'>('recover')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loadPerformanceOverview({
        schoolId: selectedSchool || undefined,
        status: selectedStatus
          ? (selectedStatus as PerformanceOverviewItem['overallStatus'])
          : undefined,
        turma: selectedTurma || undefined,
        weekStart: selectedWeek || undefined,
      })
      setItems(result)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar painel de desempenho')
    } finally {
      setLoading(false)
    }
  }, [selectedSchool, selectedStatus, selectedTurma, selectedWeek])

  const loadReferenceData = useCallback(async () => {
    const environmentStatus = await loadMentorEnvironmentStatus()
    setEnvironment(environmentStatus)

    const [topicsData, schoolsRes] = await Promise.all([
      environmentStatus.taxonomyAvailable ? loadContentTopics() : Promise.resolve([]),
      supabase.from('schools').select('id, name').order('name'),
    ])
    setTopics(topicsData)
    setSchools((schoolsRes.data ?? []) as School[])
  }, [])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const openDetail = useCallback(async (planId: string) => {
    setLoadingDetail(true)
    setError(null)
    setFeedbackMessage(null)
    try {
      const result = await loadMentorPerformanceDetail(planId)
      const summary = items.find((item) => item.planId === planId) ?? null
      setDetail({
        ...result,
        summary,
      })
      setNewTopicId('')
      setNewExpectedLevel('recover')
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar detalhe do aluno')
    } finally {
      setLoadingDetail(false)
    }
  }, [items])

  const reloadDetail = useCallback(async () => {
    if (!detail) return
    await openDetail(detail.plan.id)
    await loadOverview()
  }, [detail, loadOverview, openDetail])

  const overviewStats = useMemo(() => {
    return {
      verde: items.filter((item) => item.overallStatus === 'verde').length,
      amarelo: items.filter((item) => item.overallStatus === 'amarelo').length,
      vermelho: items.filter((item) => item.overallStatus === 'vermelho').length,
      semDados: items.filter((item) => item.overallStatus === 'sem_dados').length,
    }
  }, [items])

  const turmas = useMemo(
    () => [...new Set(items.map((item) => item.turma))].filter(Boolean).sort(),
    [items],
  )

  const handleSendPlan = useCallback(async () => {
    if (!detail) return
    setLoadingDetail(true)
    setFeedbackMessage(null)
    try {
      await sendMentorPlan(detail.plan.id)
      await reloadDetail()
      setFeedbackMessage('Plano enviado e análise atualizada.')
    } catch (err) {
      console.error(err)
      setError('Erro ao enviar plano do mentor')
    } finally {
      setLoadingDetail(false)
    }
  }, [detail, reloadDetail])

  const handleUpdateItem = useCallback(async (itemId: string, expectedLevel: 'recover' | 'maintain' | 'advance') => {
    if (!detail) return
    const item = detail.plan.items.find((entry) => entry.id === itemId)
    if (!item) return

    setLoadingDetail(true)
    try {
      await updateMentorPlanItem(itemId, {
        expectedLevel,
        notes: item.notes,
      })
      await reloadDetail()
    } catch (err) {
      console.error(err)
      setError('Erro ao atualizar item do plano')
    } finally {
      setLoadingDetail(false)
    }
  }, [detail, reloadDetail])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    setLoadingDetail(true)
    try {
      await deleteMentorPlanItem(itemId)
      await reloadDetail()
    } catch (err) {
      console.error(err)
      setError('Erro ao remover item do plano')
    } finally {
      setLoadingDetail(false)
    }
  }, [reloadDetail])

  const handleAddItem = useCallback(async () => {
    if (!detail || !newTopicId) return
    setLoadingDetail(true)
    try {
      await addMentorPlanItem({
        mentorPlanId: detail.plan.id,
        topicId: newTopicId,
        expectedLevel: newExpectedLevel,
      })
      await reloadDetail()
      setNewTopicId('')
    } catch (err) {
      console.error(err)
      setError('Erro ao adicionar tópico no plano')
    } finally {
      setLoadingDetail(false)
    }
  }, [detail, newExpectedLevel, newTopicId, reloadDetail])

  const handleAlertFeedback = useCallback(async (alert: MentorAlert, decision: 'agree' | 'disagree') => {
    setLoadingDetail(true)
    try {
      await submitMentorAlertFeedback({
        alertId: alert.id,
        decision,
      })
      await reloadDetail()
      setFeedbackMessage('Feedback do alerta registrado.')
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar feedback do alerta')
    } finally {
      setLoadingDetail(false)
    }
  }, [reloadDetail])

  if (loading && items.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className={embedded ? 'space-y-6' : 'min-h-screen bg-[#f5f5f7]'}>
      {!embedded ? (
        <header className="sticky top-0 z-20 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack ? (
                <button
                  onClick={onBack}
                  className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
                >
                  Voltar
                </button>
              ) : null}
              <h1 className="text-sm font-semibold text-[#1d1d1f]">
                Planos e mentoria
              </h1>
            </div>
            <button
              onClick={() => void loadOverview()}
              className="rounded-lg border border-[#dbe5f3] bg-[#f8fbff] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-white"
            >
              Atualizar
            </button>
          </div>
        </header>
      ) : null}

      <main className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl px-6 py-6 space-y-6'}>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {feedbackMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedbackMessage}
          </div>
        ) : null}

        {environment ? (
          <div className="rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-3 text-sm text-[#1e3a8a]">
            {environment.message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <SectionCard title="Vermelho" value={overviewStats.vermelho} className="border-rose-200" />
          <SectionCard title="Amarelo" value={overviewStats.amarelo} className="border-amber-200" />
          <SectionCard title="Verde" value={overviewStats.verde} className="border-emerald-200" />
          <SectionCard title="Sem dados" value={overviewStats.semDados} className="border-slate-200" />
        </div>

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!isCoordinator && (
              <select
                value={selectedSchool}
                onChange={(event) => setSelectedSchool(event.target.value)}
                className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#1d1d1f]"
              >
                <option value="">Todas as escolas</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedTurma}
              onChange={(event) => setSelectedTurma(event.target.value)}
              className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#1d1d1f]"
            >
              <option value="">Todas as turmas</option>
              {turmas.map((turma) => (
                <option key={turma} value={turma}>
                  {turma}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#1d1d1f]"
            >
              <option value="">Todos os status</option>
              <option value="vermelho">Vermelho</option>
              <option value="amarelo">Amarelo</option>
              <option value="verde">Verde</option>
              <option value="sem_dados">Sem dados</option>
            </select>

            <input
              type="date"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
              className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#1d1d1f]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#edf2f7] text-left text-xs uppercase tracking-[0.14em] text-[#94a3b8]">
                  <th className="px-3 py-3">Aluno</th>
                  <th className="px-3 py-3">Turma</th>
                  <th className="px-3 py-3">Semáforo</th>
                  <th className="px-3 py-3">Alertas</th>
                  <th className="px-3 py-3">Plano</th>
                  <th className="px-3 py-3">Cobertura</th>
                  <th className="px-3 py-3">Última análise</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-[#64748b]" colSpan={7}>
                      Nenhum aluno com plano do mentor encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.planId}
                      className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fbff]"
                      onClick={() => void openDetail(item.planId)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-[#111827]">{item.studentName}</p>
                        <p className="text-xs text-[#64748b]">{item.matricula}</p>
                      </td>
                      <td className="px-3 py-3 text-[#475569]">{item.turma}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[item.overallStatus]}`}>
                          {item.overallStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#475569]">
                        {item.alertCount}
                        {item.criticalAlertCount > 0 ? (
                          <span className="ml-2 text-xs font-semibold text-rose-600">
                            {item.criticalAlertCount} críticos
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[#475569]">
                        <p>{formatDate(item.weekStart)} a {formatDate(item.weekEnd)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-[#94a3b8]">
                            {item.planStatus} · {describeMentorPlanGeneration({
                              generationMode: item.generationMode,
                              taxonomySourceKind: item.taxonomySourceKind,
                            })}
                          </p>
                          {describeTaxonomySourceKind(item.taxonomySourceKind) ? (
                            <span className="rounded-full border border-[#dbe5f3] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                              {describeTaxonomySourceKind(item.taxonomySourceKind)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#475569]">
                        <p className="text-sm font-medium text-[#111827]">
                          {item.coveragePercent.toFixed(1)}%
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          {describeCoverageState(item.coverageState)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-[#475569]">
                        <p>{relativeDate(item.analyzedAt)}</p>
                        <p className="text-xs text-[#94a3b8]">{item.briefing ?? 'Sem briefing'}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[#dbe5f3] bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.55)]">
            <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                  Auditoria pedagógica
                </p>
                <h2 className="text-lg font-semibold text-[#111827]">
                  {detail.summary?.studentName ?? detail.plan.studentKey}
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  {detail.summary?.matricula ?? detail.plan.studentKey}
                  {detail.summary?.turma ? ` · Turma ${detail.summary.turma}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void reloadDetail()}
                  className="rounded-lg border border-[#dbe5f3] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-[#f8fbff]"
                >
                  Refazer análise
                </button>
                {detail.plan.status === 'draft' ? (
                  <button
                    onClick={() => void handleSendPlan()}
                    className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                  >
                    Confirmar e enviar plano
                  </button>
                ) : null}
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Fechar
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="p-10">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-6">
                  <section className="rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      Como usar esta tela
                    </p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-[#334155]">
                      <p>1. Leia o resumo do momento logo abaixo.</p>
                      <p>2. Revise se os tópicos sugeridos fazem sentido para esta semana.</p>
                      <p>3. Ajuste o nível de cada item ou remova o que não quiser manter.</p>
                      <p>4. Se concordar com o rascunho, clique em <span className="font-semibold text-[#1d4ed8]">Confirmar e enviar plano</span>.</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#e5e7eb] bg-[#f8fbff] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                          Leitura do momento
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_STYLES[detail.audit.overallStatus]}`}>
                            {formatAttentionStatus(detail.audit.overallStatus)}
                          </span>
                          <span className="text-xs text-[#64748b]">
                            {formatDate(detail.audit.analyzedAt)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-[#0f172a]">
                          O que fazer agora
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#334155]">
                          {buildNextActionText(detail)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#94a3b8]">Base usada no plano</p>
                        <p className="text-sm font-medium text-[#111827]">
                          {detail.plan.coverageScore.coveragePercent.toFixed(1)}% aproveitada
                        </p>
                        <p className="text-xs text-[#64748b]">
                          {buildCoverageExplanation(detail)}
                        </p>
                        <p className="mt-1 text-xs text-[#94a3b8]">
                          {describeMentorPlanGeneration({
                            generationMode: detail.plan.generationMode,
                            taxonomySourceKind: detail.plan.taxonomySourceKind,
                          })}
                        </p>
                        {describeTaxonomySourceKind(detail.plan.taxonomySourceKind) ? (
                          <p className="mt-1 text-xs font-semibold text-[#1d4ed8]">
                            {describeTaxonomySourceKind(detail.plan.taxonomySourceKind)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#334155]">
                      {detail.audit.briefing.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detail.audit.briefing.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full bg-white px-3 py-1 text-xs text-[#475569] ring-1 ring-[#e2e8f0]"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                          Rascunho da semana
                        </p>
                        <p className="mt-1 text-sm text-[#475569]">
                          {formatDate(detail.plan.weekStart)} a {formatDate(detail.plan.weekEnd)} · status {detail.plan.status}
                        </p>
                        <p className="mt-1 text-xs text-[#94a3b8]">
                          Qualidade da base: {detail.plan.coverageScore.coveragePercent.toFixed(1)}% · {describeCoverageState(detail.plan.coverageScore.state)}
                        </p>
                        {describeTaxonomySourceKind(detail.plan.taxonomySourceKind) ? (
                          <p className="mt-1 text-xs font-semibold text-[#1d4ed8]">
                            Origem ativa: {describeTaxonomySourceKind(detail.plan.taxonomySourceKind)}
                          </p>
                        ) : null}
                        <p className="mt-3 text-sm leading-6 text-[#334155]">
                          Esses itens são o que o sistema sugere priorizar nesta semana. Você pode manter, elevar, reduzir ou remover cada um antes de enviar.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {detail.plan.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#edf2f7] bg-[#fafcff] px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-[#111827]">
                                {buildMentorPlanItemLabel(item)}
                              </p>
                              <p className="text-xs text-[#64748b]">
                                {item.topic?.areaSigla ?? item.fallbackAreaSigla ?? '-'} · ordem {item.plannedOrder + 1}
                              </p>
                              <p className="mt-1 text-xs text-[#475569]">
                                Ação sugerida: <span className="font-semibold">{formatExpectedLevel(item.expectedLevel)}</span> — {describeExpectedLevel(item.expectedLevel)}.
                              </p>
                              {item.notes ? (
                                <p className="mt-1 text-xs text-[#475569]">{item.notes}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={item.expectedLevel}
                                onChange={(event) =>
                                  void handleUpdateItem(
                                    item.id,
                                    event.target.value as 'recover' | 'maintain' | 'advance',
                                  )
                                }
                                className="rounded-lg border border-[#dbe5f3] px-2 py-1 text-xs text-[#111827]"
                              >
                                <option value="recover">Recuperar</option>
                                <option value="maintain">Manter</option>
                                <option value="advance">Avançar</option>
                              </select>
                              <button
                                onClick={() => void handleDeleteItem(item.id)}
                                className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                        Adicionar tópico manualmente
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#475569]">
                        Use isso só quando você quiser colocar um conteúdo que o motor ainda não puxou, mas que precisa entrar no plano desta semana.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          value={newTopicId}
                          onChange={(event) => setNewTopicId(event.target.value)}
                          className="min-w-[280px] rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                        >
                          <option value="">Selecione um tópico</option>
                          {topics.map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.canonicalLabel}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newExpectedLevel}
                          onChange={(event) =>
                            setNewExpectedLevel(
                              event.target.value as 'recover' | 'maintain' | 'advance',
                            )
                          }
                          className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                        >
                          <option value="recover">Recuperar</option>
                          <option value="maintain">Manter</option>
                          <option value="advance">Avançar</option>
                        </select>
                        <button
                          onClick={() => void handleAddItem()}
                          disabled={!newTopicId}
                          className="rounded-lg bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      Tópicos mais frágeis
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#475569]">
                      Aqui estão os conteúdos em que o aluno aparece com menor domínio, segundo a leitura atual do motor.
                    </p>
                    <div className="mt-4 space-y-3">
                      {detail.audit.masteryByTopic.slice(0, 8).map((topic) => (
                        <div key={topic.topicId} className="rounded-2xl border border-[#edf2f7] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-[#111827]">{topic.canonicalLabel}</p>
                              <p className="text-xs text-[#64748b]">
                                {topic.areaSigla} · base de {topic.sampleSize} questão(ões) · confiança {topic.confidence}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-[#111827]">
                                {topic.masteryScore.toFixed(1)}
                              </p>
                              <p className="text-xs text-[#64748b]">domínio</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                      Alertas ativos
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#475569]">
                      Estes alertas existem para te ajudar a validar se o plano está atacando o problema certo. Use “Concordo” ou “Discordo” como feedback para melhorar o motor.
                    </p>
                    <div className="mt-4 space-y-3">
                      {detail.audit.alerts.length === 0 ? (
                        <p className="text-sm text-[#64748b]">
                          Nenhum alerta ativo para este plano.
                        </p>
                      ) : (
                        detail.audit.alerts.map((alert) => (
                          <div key={alert.id} className="rounded-2xl border border-[#edf2f7] px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                                    alert.severity === 'critical'
                                      ? 'bg-rose-50 text-rose-700'
                                      : alert.severity === 'warning'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-sky-50 text-sky-700'
                                  }`}>
                                    {alert.alertType}
                                  </span>
                                  {alert.topicLabel ? (
                                    <span className="text-xs text-[#64748b]">{alert.topicLabel}</span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-[#334155]">{alert.message}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void handleAlertFeedback(alert, 'agree')}
                                  className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                >
                                  Concordo
                                </button>
                                <button
                                  onClick={() => void handleAlertFeedback(alert, 'disagree')}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Discordo
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
