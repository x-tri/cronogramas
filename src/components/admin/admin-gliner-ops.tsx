import { useEffect, useState, type ReactNode } from 'react'
import {
  createContentTopic,
  describeCoverageState,
  describeTaxonomySourceKind,
  loadContentTopics,
  loadGlinerOpsOverview,
  loadOpenQuestionEnrichmentAudits,
  loadRecentQuestionEnrichmentRuns,
  loadRecentQuestionEnrichments,
} from '../../services/mentor-intelligence'
import type {
  ContentTopic,
  GlinerOpsOverview,
  QuestionEnrichment,
  QuestionEnrichmentAudit,
  QuestionEnrichmentRun,
} from '../../types/mentor-intelligence'

interface AdminGlinerOpsProps {
  onBack?: () => void
  embedded?: boolean
}

type TopicFormState = {
  areaSigla: 'LC' | 'CH' | 'CN' | 'MT' | 'RED'
  subjectLabel: string
  topicLabel: string
  canonicalLabel: string
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPct(value: number | null): string {
  if (value == null) return 'n/a'
  return `${Math.round(value * 100)}%`
}

function formatRunStatus(status: QuestionEnrichmentRun['status']): string {
  switch (status) {
    case 'running':
      return 'Rodando'
    case 'completed':
      return 'Concluído'
    case 'failed':
      return 'Falhou'
  }
}

function formatAuditType(type: QuestionEnrichmentAudit['auditType']): string {
  switch (type) {
    case 'low_confidence':
      return 'Baixa confiança'
    case 'text_image_mismatch':
      return 'Texto/imagem incoerente'
    case 'duplicate_conflict':
      return 'Conflito de duplicata'
    case 'missing_visual_context':
      return 'Contexto visual ausente'
    case 'topic_too_generic':
      return 'Tópico genérico demais'
  }
}

function formatEnrichmentType(type: QuestionEnrichment['enrichmentType']): string {
  switch (type) {
    case 'topic':
      return 'Tópico'
    case 'entity':
      return 'Entidade'
    case 'skill_hint':
      return 'Skill hint'
    case 'difficulty_hint':
      return 'Difficulty hint'
  }
}

function badgeClassBySeverity(severity: QuestionEnrichmentAudit['severity']): string {
  switch (severity) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'info':
      return 'border-sky-200 bg-sky-50 text-sky-700'
  }
}

function badgeClassByStatus(status: QuestionEnrichmentRun['status']): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700'
  }
}

const EMPTY_FORM: TopicFormState = {
  areaSigla: 'LC',
  subjectLabel: '',
  topicLabel: '',
  canonicalLabel: '',
}

export function AdminGlinerOps({
  onBack,
  embedded = false,
}: AdminGlinerOpsProps) {
  const [overview, setOverview] = useState<GlinerOpsOverview | null>(null)
  const [runs, setRuns] = useState<QuestionEnrichmentRun[]>([])
  const [enrichments, setEnrichments] = useState<QuestionEnrichment[]>([])
  const [audits, setAudits] = useState<QuestionEnrichmentAudit[]>([])
  const [topics, setTopics] = useState<ContentTopic[]>([])
  const [topicSearch, setTopicSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [topicForm, setTopicForm] = useState<TopicFormState>(EMPTY_FORM)

  async function loadPage(): Promise<void> {
    setLoading(true)
    setError(null)

    try {
      const [
        overviewData,
        runsData,
        enrichmentsData,
        auditsData,
        topicsData,
      ] = await Promise.all([
        loadGlinerOpsOverview(),
        loadRecentQuestionEnrichmentRuns(),
        loadRecentQuestionEnrichments(),
        loadOpenQuestionEnrichmentAudits(),
        loadContentTopics(),
      ])

      setOverview(overviewData)
      setRuns(runsData)
      setEnrichments(enrichmentsData)
      setAudits(auditsData)
      setTopics(topicsData)
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar o console operacional do GLiNER.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPage()
  }, [])

  const filteredTopics = topics.filter((topic) => {
    const needle = topicSearch.trim().toLowerCase()
    if (!needle) return true
    return [
      topic.canonicalLabel,
      topic.subjectLabel,
      topic.topicLabel,
      topic.areaSigla,
    ].join(' ').toLowerCase().includes(needle)
  })

  async function handleCreateTopic(): Promise<void> {
    const subjectLabel = topicForm.subjectLabel.trim()
    const topicLabel = topicForm.topicLabel.trim()
    const canonicalLabel = topicForm.canonicalLabel.trim() || `${subjectLabel} - ${topicLabel}`

    if (!subjectLabel || !topicLabel) {
      setError('Preencha disciplina e tópico para adicionar um nó canônico.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await createContentTopic({
        areaSigla: topicForm.areaSigla,
        subjectLabel,
        topicLabel,
        canonicalLabel,
      })
      setSuccess('Tópico canônico criado com sucesso.')
      setTopicForm(EMPTY_FORM)
      await loadPage()
    } catch (err) {
      console.error(err)
      setError('Erro ao criar tópico canônico.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-6' : 'min-h-screen bg-[#f5f5f7]'}>
      {!embedded ? (
        <header className="sticky top-0 z-20 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
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
                GLiNER Ops
              </h1>
            </div>
            <button
              onClick={() => void loadPage()}
              className="rounded-lg border border-[#dbe5f3] bg-[#f8fbff] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-white"
            >
              Atualizar
            </button>
          </div>
        </header>
      ) : null}

      <main className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6 px-6 py-6'}>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {overview ? (
          <>
            <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                    Motor de aprendizado
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#0f172a]">
                    Console operacional do GLiNER
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#475569]">
                    Esta página administra o enriquecimento semântico das questões, a auditoria
                    operacional do motor e o impacto disso nas recomendações pedagógicas.
                    Não é uma fila editorial de questão.
                  </p>
                </div>
                <div className="min-w-[240px] rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                    Estado atual
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#1e3a8a]">
                    {overview.environment.message}
                  </p>
                  <p className="mt-2 text-xs text-[#64748b]">
                    Cobertura: {describeCoverageState(overview.environment.state)} · Core semântico{' '}
                    {overview.semanticCoreAvailable ? 'disponível' : 'ainda não migrado'}.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Tópicos ativos"
                value={overview.topicsCount.toString()}
                note={`${overview.activeEdgesCount} arestas ativas`}
              />
              <MetricCard
                label="Mappings aprovados"
                value={overview.approvedMappingsCount.toString()}
                note={`${overview.pendingMappingsCount} pendentes herdados`}
              />
              <MetricCard
                label="Enriquecimentos"
                value={overview.activeEnrichmentsCount.toString()}
                note={`${overview.enrichmentsCount} registros no total`}
              />
              <MetricCard
                label="Auditorias abertas"
                value={overview.openAuditsCount.toString()}
                note={`${overview.criticalAuditsCount} críticas`}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                  Impacto no mentor
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CompactStat label="Planos provisórios" value={overview.mentorPlanModeCounts.fallbackGuided} />
                  <CompactStat label="Planos híbridos" value={overview.mentorPlanModeCounts.hybrid} />
                  <CompactStat label="Planos completos" value={overview.mentorPlanModeCounts.taxonomyComplete} />
                  <CompactStat label="Prévia local" value={overview.mentorPlanModeCounts.previewOnly} />
                </div>
                <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#475569]">
                  <p className="font-medium text-[#0f172a]">Origem de taxonomia em uso</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <CompactStat label="Nenhuma" value={overview.taxonomySourceCounts.none} />
                    <CompactStat label="Homologação" value={overview.taxonomySourceCounts.homologation} />
                    <CompactStat label="Misto" value={overview.taxonomySourceCounts.mixed} />
                    <CompactStat label="Produção" value={overview.taxonomySourceCounts.production} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                  Adicionar tópico canônico
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                    <select
                      value={topicForm.areaSigla}
                      onChange={(event) =>
                        setTopicForm((prev) => ({
                          ...prev,
                          areaSigla: event.target.value as TopicFormState['areaSigla'],
                        }))
                      }
                      className="rounded-xl border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                    >
                      <option value="LC">LC</option>
                      <option value="CH">CH</option>
                      <option value="CN">CN</option>
                      <option value="MT">MT</option>
                      <option value="RED">RED</option>
                    </select>
                    <input
                      value={topicForm.subjectLabel}
                      onChange={(event) =>
                        setTopicForm((prev) => ({ ...prev, subjectLabel: event.target.value }))
                      }
                      placeholder="Disciplina"
                      className="rounded-xl border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>
                  <input
                    value={topicForm.topicLabel}
                    onChange={(event) =>
                      setTopicForm((prev) => ({ ...prev, topicLabel: event.target.value }))
                    }
                    placeholder="Tópico"
                    className="rounded-xl border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                  />
                  <input
                    value={topicForm.canonicalLabel}
                    onChange={(event) =>
                      setTopicForm((prev) => ({ ...prev, canonicalLabel: event.target.value }))
                    }
                    placeholder="Rótulo canônico (opcional, será gerado se vazio)"
                    className="rounded-xl border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateTopic()}
                    disabled={saving}
                    className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Salvando...' : 'Adicionar tópico'}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                    Taxonomia ativa
                  </p>
                  <p className="mt-1 text-sm text-[#475569]">
                    Nós canônicos disponíveis hoje para o motor interpretar questões, sinais e
                    explicações.
                  </p>
                </div>
                <input
                  value={topicSearch}
                  onChange={(event) => setTopicSearch(event.target.value)}
                  placeholder="Buscar tópico, disciplina ou área"
                  className="w-full rounded-xl border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827] md:max-w-sm"
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredTopics.slice(0, 12).map((topic) => (
                  <div key={topic.id} className="rounded-2xl border border-[#edf2f7] bg-[#fafafa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                        {topic.areaSigla}
                      </span>
                      {describeTaxonomySourceKind(topic.originSourceContext) ? (
                        <span className="rounded-full border border-[#dbe5f3] px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8]">
                          {describeTaxonomySourceKind(topic.originSourceContext)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#0f172a]">
                      {topic.canonicalLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {topic.subjectLabel} · {topic.topicLabel}
                    </p>
                  </div>
                ))}
                {filteredTopics.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                    Nenhum tópico encontrado com o filtro atual.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <DataPanel
                title="Enriquecimentos recentes"
                description="Saída semântica mais recente gerada pelo motor."
              >
                {enrichments.length === 0 ? (
                  <EmptyState text="Nenhum enriquecimento registrado ainda neste ambiente." />
                ) : (
                  <div className="space-y-3">
                    {enrichments.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[#edf2f7] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#0f172a]">
                            {item.examId} · Q{item.questionNumber}
                          </span>
                          <span className="rounded-full border border-[#dbe5f3] px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8]">
                            {formatEnrichmentType(item.enrichmentType)}
                          </span>
                          <span className="rounded-full border border-[#e5e7eb] px-2 py-0.5 text-[11px] text-[#475569]">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#334155]">
                          {item.canonicalLabel ?? item.topic?.canonicalLabel ?? 'Sem label canônico'}
                        </p>
                        <p className="mt-1 text-xs text-[#64748b]">
                          modelo {item.sourceModel} · origem {describeTaxonomySourceKind(item.sourceContext) ?? item.sourceContext} · confiança {formatPct(item.confidenceScore)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DataPanel>

              <DataPanel
                title="Runs recentes"
                description="Execuções do motor de enriquecimento e sua saúde operacional."
              >
                {runs.length === 0 ? (
                  <EmptyState text="Nenhum run do GLiNER registrado ainda." />
                ) : (
                  <div className="space-y-3">
                    {runs.map((run) => (
                      <div key={run.id} className="rounded-2xl border border-[#edf2f7] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#0f172a]">
                              {run.modelName}
                            </p>
                            <p className="mt-1 text-xs text-[#64748b]">
                              {run.sourceSystem} · {run.sourceReference ?? 'sem referência'}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClassByStatus(run.status)}`}>
                            {formatRunStatus(run.status)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[#475569] sm:grid-cols-3">
                          <p>Processadas: {run.itemsProcessed}</p>
                          <p>Gravadas: {run.itemsWritten}</p>
                          <p>Flaggadas: {run.itemsFlagged}</p>
                        </div>
                        <p className="mt-2 text-xs text-[#94a3b8]">
                          {formatDate(run.createdAt)}
                          {run.finishedAt ? ` → ${formatDate(run.finishedAt)}` : ''}
                        </p>
                        {run.errorSummary ? (
                          <p className="mt-2 text-xs text-rose-600">{run.errorSummary}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </DataPanel>
            </section>

            <DataPanel
              title="Auditoria aberta"
              description="Conflitos e ruídos que precisam de observação operacional no motor."
            >
              {audits.length === 0 ? (
                <EmptyState text="Nenhuma auditoria aberta. O motor está sem conflitos ativos registrados." />
              ) : (
                <div className="space-y-3">
                  {audits.map((audit) => (
                    <div key={audit.id} className="rounded-2xl border border-[#edf2f7] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClassBySeverity(audit.severity)}`}>
                          {audit.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-[#0f172a]">
                          {formatAuditType(audit.auditType)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#64748b]">
                        criado em {formatDate(audit.createdAt)} · status {audit.status}
                      </p>
                      {Object.keys(audit.evidence).length > 0 ? (
                        <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#0f172a] p-3 text-[11px] leading-5 text-[#e2e8f0]">
                          {JSON.stringify(audit.evidence, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </DataPanel>
          </>
        ) : null}
      </main>
    </div>
  )
}

function MetricCard(props: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
        {props.label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#0f172a]">
        {props.value}
      </p>
      <p className="mt-2 text-sm text-[#64748b]">{props.note}</p>
    </div>
  )
}

function CompactStat(props: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#edf2f7] bg-white p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-[#94a3b8]">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0f172a]">
        {props.value}
      </p>
    </div>
  )
}

function DataPanel(props: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-[#e5e7eb] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
        {props.title}
      </p>
      <p className="mt-1 text-sm text-[#475569]">{props.description}</p>
      <div className="mt-4">{props.children}</div>
    </section>
  )
}

function EmptyState(props: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-8 text-center text-sm text-[#64748b]">
      {props.text}
    </div>
  )
}
