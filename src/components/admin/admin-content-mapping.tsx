import { useCallback, useEffect, useMemo, useState } from 'react'
import { simuladoSupabase } from '../../lib/simulado-supabase'
import {
  describeTaxonomySourceKind,
  loadContentTopics,
  loadMentorEnvironmentStatus,
  loadPendingContentMappings,
  reviewContentMapping,
} from '../../services/mentor-intelligence'
import type {
  ContentTopic,
  ExamQuestionTopic,
  MentorEnvironmentStatus,
} from '../../types/mentor-intelligence'
import type { QuestionContent } from '../../types/supabase'

type MappingContext = {
  readonly examTitle: string | null
  readonly questionText: string | null
  readonly suggestedLabel: string | null
  readonly summary: string | null
}

interface AdminContentMappingProps {
  onBack?: () => void
  embedded?: boolean
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseQuestionNumber(item: Record<string, unknown>): number | null {
  const candidates = [item.questionNumber, item.numero, item.questao]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function extractQuestionText(question: Record<string, unknown>): string | null {
  const candidates = [
    question.content,
    question.conteudo,
    question.topic,
    question.topico,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function toQuestionContents(payload: unknown): QuestionContent[] {
  if (!Array.isArray(payload)) return []
  return payload as QuestionContent[]
}

async function loadMappingContexts(
  mappings: ReadonlyArray<ExamQuestionTopic>,
): Promise<Map<string, MappingContext>> {
  const examIds = [...new Set(mappings.map((mapping) => mapping.examId))]
  if (examIds.length === 0) {
    return new Map()
  }

  const [examsRes, projetosRes] = await Promise.all([
    simuladoSupabase
      .from('exams')
      .select('id, title, question_contents')
      .in('id', examIds),
    simuladoSupabase
      .from('projetos')
      .select('id, nome, question_contents')
      .in('id', examIds),
  ])

  const records = new Map<
    string,
    {
      title: string | null
      questionContents: QuestionContent[]
    }
  >()

  for (const exam of (examsRes.data ?? []) as Array<{
    id: string
    title: string | null
    question_contents: QuestionContent[] | null
  }>) {
    records.set(exam.id, {
      title: exam.title,
      questionContents: toQuestionContents(exam.question_contents),
    })
  }

  for (const projeto of (projetosRes.data ?? []) as Array<{
    id: string
    nome: string | null
    question_contents: QuestionContent[] | null
  }>) {
    if (records.has(projeto.id)) continue
    records.set(projeto.id, {
      title: projeto.nome,
      questionContents: toQuestionContents(projeto.question_contents),
    })
  }

  const contexts = new Map<string, MappingContext>()

  for (const mapping of mappings) {
    const record = records.get(mapping.examId)
    const question = record?.questionContents.find((item) => {
      const raw = item as Record<string, unknown>
      return parseQuestionNumber(raw) === mapping.questionNumber
    }) as (QuestionContent & {
      gliner?: {
        suggestedLabel?: string | null
        approvedLabel?: string | null
        summary?: string | null
      } | null
    }) | undefined

    contexts.set(mapping.id, {
      examTitle: record?.title ?? null,
      questionText: question ? extractQuestionText(question as Record<string, unknown>) : null,
      suggestedLabel:
        question?.gliner?.approvedLabel ??
        question?.gliner?.suggestedLabel ??
        mapping.topic?.canonicalLabel ??
        null,
      summary: question?.gliner?.summary ?? null,
    })
  }

  return contexts
}

export function AdminContentMapping({
  onBack,
  embedded = false,
}: AdminContentMappingProps) {
  const [topics, setTopics] = useState<ContentTopic[]>([])
  const [mappings, setMappings] = useState<ExamQuestionTopic[]>([])
  const [contexts, setContexts] = useState<Map<string, MappingContext>>(new Map())
  const [topicOverrides, setTopicOverrides] = useState<Record<string, string>>({})
  const [environment, setEnvironment] = useState<MentorEnvironmentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'homologation' | 'production'>('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const environmentStatus = await loadMentorEnvironmentStatus()
      setEnvironment(environmentStatus)

      if (!environmentStatus.taxonomyAvailable) {
        setTopics([])
        setMappings([])
        setContexts(new Map())
        setTopicOverrides({})
        return
      }

      const [topicsData, mappingsData] = await Promise.all([
        loadContentTopics(),
        loadPendingContentMappings(),
      ])
      const mappingContexts = await loadMappingContexts(mappingsData)

      setTopics(topicsData)
      setMappings(mappingsData)
      setContexts(mappingContexts)
      setTopicOverrides(
        Object.fromEntries(
          mappingsData
            .filter((mapping) => mapping.topicId)
            .map((mapping) => [mapping.id, mapping.topicId ?? '']),
        ),
      )
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar fila de mapeamento.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const filteredMappings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return mappings

    return mappings.filter((mapping) => {
      const context = contexts.get(mapping.id)
      const haystack = [
        mapping.examId,
        mapping.questionNumber.toString(),
        context?.examTitle ?? '',
        context?.questionText ?? '',
        context?.suggestedLabel ?? '',
        mapping.topic?.canonicalLabel ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [contexts, mappings, search])

  const sourceFilteredMappings = useMemo(() => {
    if (sourceFilter === 'all') {
      return filteredMappings
    }

    return filteredMappings.filter((mapping) => mapping.sourceContext === sourceFilter)
  }, [filteredMappings, sourceFilter])

  const handleApprove = useCallback(async (mapping: ExamQuestionTopic) => {
    const topicId = topicOverrides[mapping.id] ?? mapping.topicId

    if (!topicId) {
      setError('Selecione um tópico canônico antes de aprovar o mapeamento.')
      return
    }

    setSavingId(mapping.id)
    setError(null)
    setSuccess(null)

    try {
      await reviewContentMapping({
        mappingId: mapping.id,
        topicId,
        reviewStatus: 'approved',
        confidence: mapping.confidence,
        originalTopicId: mapping.topicId,
        mappingSource: mapping.mappingSource,
      })
      setSuccess('Mapeamento aprovado e enviado para a taxonomia canônica.')
      await loadQueue()
    } catch (err) {
      console.error(err)
      setError('Erro ao aprovar o mapeamento.')
    } finally {
      setSavingId(null)
    }
  }, [loadQueue, topicOverrides])

  const handleReject = useCallback(async (mapping: ExamQuestionTopic) => {
    setSavingId(mapping.id)
    setError(null)
    setSuccess(null)

    try {
      await reviewContentMapping({
        mappingId: mapping.id,
        topicId: null,
        reviewStatus: 'rejected',
        confidence: mapping.confidence,
        originalTopicId: mapping.topicId,
        mappingSource: mapping.mappingSource,
      })
      setSuccess('Mapeamento rejeitado e removido da fila pendente.')
      await loadQueue()
    } catch (err) {
      console.error(err)
      setError('Erro ao rejeitar o mapeamento.')
    } finally {
      setSavingId(null)
    }
  }, [loadQueue])

  if (loading && mappings.length === 0) {
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
                Fila de Mapeamento de Conteúdo
              </h1>
            </div>
            <button
              onClick={() => void loadQueue()}
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

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {environment ? (
          <div className="rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-3 text-sm text-[#1e3a8a]">
            {environment.message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                Revisão GLiNER
              </p>
              <p className="mt-1 text-sm text-[#475569]">
                {mappings.length} questão(ões) aguardando aprovação manual.
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por prova, questão ou rótulo sugerido"
              className="w-full rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827] md:max-w-sm"
            />
            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as 'all' | 'homologation' | 'production')
              }
              className="rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#1d1d1f]"
            >
              <option value="all">Todas as origens</option>
              <option value="homologation">Homologação</option>
              <option value="production">Produção</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#edf2f7] text-left text-xs uppercase tracking-[0.14em] text-[#94a3b8]">
                  <th className="px-4 py-3">Questão</th>
                  <th className="px-4 py-3">Contexto real</th>
                  <th className="px-4 py-3">Sugestão</th>
                  <th className="px-4 py-3">Tópico canônico</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sourceFilteredMappings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-[#64748b]" colSpan={5}>
                      Nenhum mapeamento pendente na fila atual.
                    </td>
                  </tr>
                ) : (
                  sourceFilteredMappings.map((mapping) => {
                    const context = contexts.get(mapping.id)
                    const isSaving = savingId === mapping.id

                    return (
                      <tr key={mapping.id} className="border-b border-[#f1f5f9] align-top">
                        <td className="px-4 py-4">
                          <p className="font-medium text-[#111827]">
                            {context?.examTitle ?? mapping.examId}
                          </p>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {mapping.examId} · questão {mapping.questionNumber}
                          </p>
                          <p className="mt-1 text-xs text-[#94a3b8]">
                            {formatDate(mapping.createdAt)}
                          </p>
                          {describeTaxonomySourceKind(mapping.sourceContext) ? (
                            <span className="mt-2 inline-flex rounded-full border border-[#dbe5f3] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                              {describeTaxonomySourceKind(mapping.sourceContext)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="line-clamp-3 max-w-xl text-sm text-[#334155]">
                            {context?.questionText ?? 'Sem texto sincronizado da questão.'}
                          </p>
                          {context?.summary ? (
                            <p className="mt-2 text-xs text-[#64748b]">
                              Resumo GLiNER: {context.summary}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-[#111827]">
                            {context?.suggestedLabel ?? mapping.topic?.canonicalLabel ?? 'Sem sugestão'}
                          </p>
                          <p className="mt-1 text-xs text-[#64748b]">
                            origem {mapping.mappingSource} · confiança{' '}
                            {mapping.confidence != null ? mapping.confidence.toFixed(2) : 'n/a'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={topicOverrides[mapping.id] ?? ''}
                            onChange={(event) =>
                              setTopicOverrides((prev) => ({
                                ...prev,
                                [mapping.id]: event.target.value,
                              }))
                            }
                            className="min-w-[280px] rounded-lg border border-[#dbe5f3] px-3 py-2 text-sm text-[#111827]"
                          >
                            <option value="">Selecione o tópico canônico</option>
                            {topics.map((topic) => (
                              <option key={topic.id} value={topic.id}>
                                {topic.canonicalLabel}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => void handleApprove(mapping)}
                              disabled={isSaving}
                              className="rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => void handleReject(mapping)}
                              disabled={isSaving}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
                            >
                              Rejeitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
