import { supabase } from '../lib/supabase'
import { simuladoSupabase } from '../lib/simulado-supabase'
import { logAudit } from './audit'
import {
  buildStudentPerformanceAudit,
  type PlanTopicRef,
  type TopicPerformanceRecord,
} from './mentor-gap-engine'
import {
  ALERT_FEEDBACK_DECISIONS,
  contentTopicFromRow,
  examQuestionTopicFromRow,
  mentorPlanItemFromRow,
  questionEnrichmentAuditFromRow,
  questionEnrichmentFromRow,
  questionEnrichmentRunFromRow,
  type ContentMappingSource,
  type ContentTopic,
  type ContentTopicRow,
  type ExamQuestionTopic,
  type ExamQuestionTopicRow,
  type GlinerOpsOverview,
  type MentorCapabilityState,
  type MentorEnvironmentStatus,
  type MentorAlertFeedbackDecision,
  type MentorAlertRow,
  type MentorPlanItem,
  type MentorPlanItemRow,
  type MentorPlanCreationInput,
  type PlanGenerationMode,
  type MentorPlanRow,
  type MentorPlanStatus,
  type MentorPlanSummary,
  type QuestionEnrichment,
  type QuestionEnrichmentAudit,
  type QuestionEnrichmentAuditRow,
  type QuestionEnrichmentRow,
  type QuestionEnrichmentRun,
  type QuestionEnrichmentRunRow,
  type StudentPerformanceAudit,
  type TaxonomyCoverageScore,
  type TaxonomySourceKind,
} from '../types/mentor-intelligence'
import type { QuestionContent, SimuladoResult } from '../types/supabase'
import type { ReportData } from '../types/report'
import { buildStudentKey, buildStudentNumberCandidates, parseStudentKey } from './student-key'

type ProjectUserContext = {
  userId: string
  schoolId: string | null
  role: string
  name: string | null
}

type MentorPlanSelectRow = MentorPlanRow & {
  items?: MentorPlanItemRow[] | null
}

export type PerformanceOverviewItem = {
  readonly planId: string
  readonly studentKey: string
  readonly studentName: string
  readonly matricula: string
  readonly turma: string
  readonly schoolId: string
  readonly schoolName: string | null
  readonly planStatus: MentorPlanStatus
  readonly capabilityState: MentorCapabilityState
  readonly generationMode: PlanGenerationMode
  readonly taxonomySourceKind: TaxonomySourceKind
  readonly coveragePercent: number
  readonly coverageState: MentorCapabilityState
  readonly overallStatus: 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'
  readonly alertCount: number
  readonly criticalAlertCount: number
  readonly weekStart: string
  readonly weekEnd: string
  readonly briefing: string | null
  readonly analyzedAt: string | null
  readonly updatedAt: string
}

type StudentIdentity = {
  readonly studentName: string
  readonly matricula: string
  readonly turma: string
  readonly schoolName: string | null
}

type RawPerformanceRecord = {
  readonly examId: string
  readonly assessedAt: string
  readonly questionNumber: number
  readonly correct: boolean
}

type PlanItemSeed = {
  readonly topicId: string | null
  readonly topic: ContentTopic | null
  readonly fallbackLabel: string | null
  readonly fallbackAreaSigla: string | null
  readonly fallbackHabilidade: number | null
  readonly expectedLevel: MentorPlanItem['expectedLevel']
  readonly source: MentorPlanItem['source']
  readonly notes: string | null
}

const ENVIRONMENT_STATUS_TTL_MS = 30_000

let mentorEnvironmentStatusCache:
  | {
      readonly expiresAt: number
      readonly value: MentorEnvironmentStatus
    }
  | null = null
let mentorEnvironmentStatusPromise: Promise<MentorEnvironmentStatus> | null = null

const MENTOR_CORE_TABLES = [
  'mentor_plans',
  'mentor_plan_items',
  'mentor_analysis_runs',
  'mentor_alerts',
  'mentor_alert_feedback',
] as const

const MENTOR_TAXONOMY_TABLES = [
  'content_topics',
  'exam_question_topics',
] as const

const GLINER_SEMANTIC_TABLES = [
  'topic_edges',
  'question_enrichment_runs',
  'question_enrichments',
  'question_enrichment_sources',
  'question_enrichment_audits',
] as const

type ProjetoStudent = {
  readonly id?: string
  readonly matricula?: string
  readonly student_number?: string
  readonly studentNumber?: string
  readonly answers?: string[]
}

type ProjetoRow = {
  readonly id: string
  readonly created_at: string
  readonly answer_key?: string[] | null
  readonly question_contents?: QuestionContent[] | null
  readonly students?: ProjetoStudent[] | null
}

function getCurrentWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const start = new Date(now)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(now.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  }
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isSchemaCacheMissing(message: string | undefined): boolean {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    normalized.includes('relation') && normalized.includes('does not exist')
  )
}

async function resourceExists(
  tableName: string,
  selectClause = 'id',
): Promise<boolean> {
  const { error } = await supabase
    .from(tableName)
    .select(selectClause, { count: 'exact' })
    .limit(1)

  if (!error) {
    return true
  }

  if (isSchemaCacheMissing(error.message)) {
    return false
  }

    throw new Error(`Falha ao verificar a capacidade ${tableName}: ${error.message}`)
  }

function buildEnvironmentStatus(
  state: MentorCapabilityState,
): MentorEnvironmentStatus {
  switch (state) {
    case 'core_missing':
      return {
        state,
        coreAvailable: false,
        taxonomyAvailable: false,
        message: 'Módulo do mentor não instalado neste ambiente.',
      }
    case 'taxonomy_missing':
      return {
        state,
        coreAvailable: true,
        taxonomyAvailable: false,
        message: 'Taxonomia do mentor indisponível. O plano será salvo em modo provisório.',
      }
    case 'taxonomy_partial':
      return {
        state,
        coreAvailable: true,
        taxonomyAvailable: true,
        message: 'Cobertura taxonômica parcial. O plano será salvo em modo híbrido.',
      }
    case 'ready':
      return {
        state,
        coreAvailable: true,
        taxonomyAvailable: true,
        message: 'Taxonomia pronta para gerar o plano completo.',
      }
  }
}

export function computeCoverageScore(
  totalPairs: number,
  mappings: ReadonlyArray<ExamQuestionTopic>,
): TaxonomyCoverageScore {
  const mappedPairs = mappings.length
  const distinctTopics = new Set(
    mappings
      .map((mapping) => mapping.topicId)
      .filter((value): value is string => Boolean(value)),
  ).size
  const coveragePercent =
    totalPairs > 0 ? Math.round((mappedPairs / totalPairs) * 10_000) / 100 : 0

  let state: MentorCapabilityState = 'taxonomy_missing'
  if (mappedPairs === 0 || totalPairs === 0) {
    state = 'taxonomy_missing'
  } else if (coveragePercent >= 70 && distinctTopics >= 3) {
    state = 'ready'
  } else {
    state = 'taxonomy_partial'
  }

  return {
    state,
    mappedPairs,
    totalPairs,
    coveragePercent,
    distinctTopics,
  }
}

export function resolvePlanGenerationMode(state: MentorCapabilityState): PlanGenerationMode {
  switch (state) {
    case 'core_missing':
      return 'preview_only'
    case 'taxonomy_missing':
      return 'fallback_guided'
    case 'taxonomy_partial':
      return 'hybrid'
    case 'ready':
      return 'taxonomy_complete'
  }
}

function mergeCapabilityWithCoverage(
  environment: MentorEnvironmentStatus,
  coverage: TaxonomyCoverageScore,
): TaxonomyCoverageScore {
  if (!environment.coreAvailable) {
    return {
      ...coverage,
      state: 'core_missing',
    }
  }

  if (!environment.taxonomyAvailable) {
    return {
      ...coverage,
      state: 'taxonomy_missing',
    }
  }

  return coverage
}

function buildFallbackLabelFromTopic(topic: ContentTopic | null): string | null {
  return topic?.canonicalLabel ?? null
}

export function buildMentorPlanItemLabel(item: MentorPlanItem): string {
  return item.topic?.canonicalLabel ?? item.fallbackLabel ?? 'Tópico sem rótulo'
}

export function resolveTaxonomySourceKind(
  mappings: ReadonlyArray<Pick<ExamQuestionTopic, 'sourceContext'>>,
): TaxonomySourceKind {
  if (mappings.length === 0) {
    return 'none'
  }

  const kinds = new Set<TaxonomySourceKind>()
  for (const mapping of mappings) {
    kinds.add(mapping.sourceContext === 'homologation' ? 'homologation' : 'production')
  }

  if (kinds.size > 1) {
    return 'mixed'
  }

  return kinds.has('homologation') ? 'homologation' : 'production'
}

export function describeCoverageState(state: MentorCapabilityState): string {
  switch (state) {
    case 'ready':
      return 'Cobertura suficiente'
    case 'taxonomy_partial':
      return 'Cobertura parcial'
    case 'core_missing':
      return 'Módulo indisponível'
    case 'taxonomy_missing':
      return 'Sem taxonomia aprovada'
  }
}

export function describeTaxonomySourceKind(kind: TaxonomySourceKind): string | null {
  switch (kind) {
    case 'none':
      return null
    case 'homologation':
      return 'Homologação'
    case 'mixed':
      return 'Homologação + Produção'
    case 'production':
      return 'Produção'
  }
}

export function describeMentorPlanGeneration(params: {
  generationMode: PlanGenerationMode
  taxonomySourceKind: TaxonomySourceKind
}): string {
  const { generationMode, taxonomySourceKind } = params

  if (generationMode === 'preview_only' && taxonomySourceKind === 'none') {
    return 'Prévia local - módulo do mentor indisponível'
  }

  if (generationMode === 'fallback_guided' && taxonomySourceKind === 'none') {
    return 'Plano provisório - revisão necessária'
  }

  if (generationMode === 'hybrid' && taxonomySourceKind === 'homologation') {
    return 'Plano híbrido - homologação'
  }

  if (generationMode === 'hybrid') {
    return 'Plano híbrido - cobertura parcial'
  }

  if (generationMode === 'taxonomy_complete' && taxonomySourceKind === 'homologation') {
    return 'Plano taxonômico completo - homologação'
  }

  return 'Plano taxonômico completo'
}

export function describePlanGenerationMode(mode: PlanGenerationMode): string {
  return describeMentorPlanGeneration({
    generationMode: mode,
    taxonomySourceKind:
      mode === 'preview_only' || mode === 'fallback_guided' ? 'none' : 'production',
  })
}

function mapMentorPlan(row: MentorPlanSelectRow): MentorPlanSummary {
  return {
    id: row.id,
    schoolId: row.school_id,
    mentorUserId: row.mentor_user_id,
    targetType: row.target_type,
    studentKey: row.student_key,
    turma: row.turma,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    source: row.source,
    status: row.status,
    capabilityState: row.capability_state,
    generationMode: row.generation_mode,
    taxonomySourceKind: row.taxonomy_source_kind,
    coverageScore: {
      state: row.capability_state,
      mappedPairs: row.mapped_pairs,
      totalPairs: row.total_pairs,
      coveragePercent: row.coverage_percent,
      distinctTopics: row.distinct_topics,
    },
    isPreviewOnly: row.generation_mode === 'preview_only',
    pdfHistoryId: row.pdf_history_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.items ?? [])
      .map(mentorPlanItemFromRow)
      .sort((left, right) => left.plannedOrder - right.plannedOrder),
  }
}

async function getCurrentProjectUser(): Promise<ProjectUserContext> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Sessão inválida para ações do mentor.')
  }

  const { data: projectUser, error } = await supabase
    .from('project_users')
    .select('auth_uid, school_id, role, name')
    .eq('auth_uid', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !projectUser) {
    throw new Error('Usuário sem contexto ativo para ações de mentoria.')
  }

  return {
    userId: user.id,
    schoolId: (projectUser.school_id as string | null) ?? null,
    role: (projectUser.role as string) ?? 'coordinator',
    name: (projectUser.name as string | null) ?? null,
  }
}

async function resolveTargetSchoolId(params: {
  projectUser: ProjectUserContext
  student: {
    id?: string | null
    matricula?: string | null
    escola?: string | null
  }
}): Promise<string> {
  if (params.projectUser.schoolId) {
    return params.projectUser.schoolId
  }

  const matricula = params.student.matricula?.trim()

  if (matricula) {
    const { data, error } = await supabase
      .from('students')
      .select('school_id')
      .eq('matricula', matricula)
      .maybeSingle()

    if (error) {
      throw new Error(`Falha ao resolver a escola do aluno: ${error.message}`)
    }

    if (data?.school_id) {
      return data.school_id as string
    }
  }

  throw new Error('Não foi possível resolver a escola do aluno para salvar o plano do mentor.')
}

export async function loadMentorEnvironmentStatus(): Promise<MentorEnvironmentStatus> {
  const now = Date.now()
  if (mentorEnvironmentStatusCache && mentorEnvironmentStatusCache.expiresAt > now) {
    return mentorEnvironmentStatusCache.value
  }

  if (mentorEnvironmentStatusPromise) {
    return mentorEnvironmentStatusPromise
  }

  mentorEnvironmentStatusPromise = (async () => {
  const [coreChecks, taxonomyChecks] = await Promise.all([
    Promise.all([
      resourceExists(
        MENTOR_CORE_TABLES[0],
        'id, capability_state, generation_mode, mapped_pairs, total_pairs, coverage_percent, distinct_topics',
      ),
      resourceExists(
        MENTOR_CORE_TABLES[1],
        'id, topic_id, fallback_label, fallback_area_sigla, fallback_habilidade',
      ),
      resourceExists(MENTOR_CORE_TABLES[2]),
      resourceExists(MENTOR_CORE_TABLES[3]),
      resourceExists(MENTOR_CORE_TABLES[4]),
    ]),
    Promise.all(MENTOR_TAXONOMY_TABLES.map((tableName) => resourceExists(tableName))),
  ])

  const coreAvailable = coreChecks.every(Boolean)
  if (!coreAvailable) {
    return buildEnvironmentStatus('core_missing')
  }

  const taxonomyAvailable = taxonomyChecks.every(Boolean)
  if (!taxonomyAvailable) {
      return buildEnvironmentStatus('taxonomy_missing')
  }

    return buildEnvironmentStatus('ready')
  })()

  try {
    const value = await mentorEnvironmentStatusPromise
    mentorEnvironmentStatusCache = {
      value,
      expiresAt: Date.now() + ENVIRONMENT_STATUS_TTL_MS,
    }
    return value
  } finally {
    mentorEnvironmentStatusPromise = null
  }
}

type CountFilter = {
  readonly column: string
  readonly value: string | number | boolean
}

async function countRowsSafe(
  tableName: string,
  filters: ReadonlyArray<CountFilter> = [],
): Promise<number> {
  let query = supabase
    .from(tableName)
    .select('id', { count: 'exact' })
    .limit(1)

  for (const filter of filters) {
    query = query.eq(filter.column, filter.value)
  }

  const { count, error } = await query

  if (!error) {
    return count ?? 0
  }

  if (isSchemaCacheMissing(error.message)) {
    return 0
  }

  throw new Error(`Falha ao contar registros em ${tableName}: ${error.message}`)
}

async function loadSemanticCoreAvailability(): Promise<boolean> {
  const checks = await Promise.all(GLINER_SEMANTIC_TABLES.map((tableName) => resourceExists(tableName)))
  return checks.every(Boolean)
}

export async function loadGlinerOpsOverview(): Promise<GlinerOpsOverview> {
  const environment = await loadMentorEnvironmentStatus()
  const semanticCoreAvailable = await loadSemanticCoreAvailability()

  const [
    topicsCount,
    approvedMappingsCount,
    pendingMappingsCount,
    homologationMappingsCount,
    productionMappingsCount,
    previewOnlyCount,
    fallbackGuidedCount,
    hybridCount,
    taxonomyCompleteCount,
    taxonomyNoneCount,
    taxonomyHomologationCount,
    taxonomyMixedCount,
    taxonomyProductionCount,
    activeEdgesCount,
    enrichmentsCount,
    activeEnrichmentsCount,
    openAuditsCount,
    criticalAuditsCount,
  ] = await Promise.all([
    environment.taxonomyAvailable
      ? countRowsSafe('content_topics', [{ column: 'is_active', value: true }])
      : Promise.resolve(0),
    environment.taxonomyAvailable
      ? countRowsSafe('exam_question_topics', [
          { column: 'is_active', value: true },
          { column: 'review_status', value: 'approved' },
        ])
      : Promise.resolve(0),
    environment.taxonomyAvailable
      ? countRowsSafe('exam_question_topics', [
          { column: 'is_active', value: true },
          { column: 'review_status', value: 'pending' },
        ])
      : Promise.resolve(0),
    environment.taxonomyAvailable
      ? countRowsSafe('exam_question_topics', [
          { column: 'is_active', value: true },
          { column: 'source_context', value: 'homologation' },
        ])
      : Promise.resolve(0),
    environment.taxonomyAvailable
      ? countRowsSafe('exam_question_topics', [
          { column: 'is_active', value: true },
          { column: 'source_context', value: 'production' },
        ])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'generation_mode', value: 'preview_only' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'generation_mode', value: 'fallback_guided' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'generation_mode', value: 'hybrid' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'generation_mode', value: 'taxonomy_complete' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'taxonomy_source_kind', value: 'none' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'taxonomy_source_kind', value: 'homologation' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'taxonomy_source_kind', value: 'mixed' }])
      : Promise.resolve(0),
    environment.coreAvailable
      ? countRowsSafe('mentor_plans', [{ column: 'taxonomy_source_kind', value: 'production' }])
      : Promise.resolve(0),
    semanticCoreAvailable
      ? countRowsSafe('topic_edges', [{ column: 'is_active', value: true }])
      : Promise.resolve(0),
    semanticCoreAvailable
      ? countRowsSafe('question_enrichments')
      : Promise.resolve(0),
    semanticCoreAvailable
      ? countRowsSafe('question_enrichments', [{ column: 'status', value: 'active' }])
      : Promise.resolve(0),
    semanticCoreAvailable
      ? countRowsSafe('question_enrichment_audits', [{ column: 'status', value: 'open' }])
      : Promise.resolve(0),
    semanticCoreAvailable
      ? countRowsSafe('question_enrichment_audits', [
          { column: 'status', value: 'open' },
          { column: 'severity', value: 'critical' },
        ])
      : Promise.resolve(0),
  ])

  return {
    environment,
    semanticCoreAvailable,
    topicsCount,
    activeEdgesCount,
    approvedMappingsCount,
    pendingMappingsCount,
    homologationMappingsCount,
    productionMappingsCount,
    enrichmentsCount,
    activeEnrichmentsCount,
    openAuditsCount,
    criticalAuditsCount,
    mentorPlanModeCounts: {
      previewOnly: previewOnlyCount,
      fallbackGuided: fallbackGuidedCount,
      hybrid: hybridCount,
      taxonomyComplete: taxonomyCompleteCount,
    },
    taxonomySourceCounts: {
      none: taxonomyNoneCount,
      homologation: taxonomyHomologationCount,
      mixed: taxonomyMixedCount,
      production: taxonomyProductionCount,
    },
  }
}

export async function loadRecentQuestionEnrichmentRuns(
  limit = 8,
): Promise<QuestionEnrichmentRun[]> {
  const semanticCoreAvailable = await loadSemanticCoreAvailability()
  if (!semanticCoreAvailable) {
    return []
  }

  const { data, error } = await supabase
    .from('question_enrichment_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Falha ao carregar runs do GLiNER: ${error.message}`)
  }

  return ((data ?? []) as QuestionEnrichmentRunRow[]).map(questionEnrichmentRunFromRow)
}

export async function loadRecentQuestionEnrichments(
  limit = 12,
): Promise<QuestionEnrichment[]> {
  const semanticCoreAvailable = await loadSemanticCoreAvailability()
  if (!semanticCoreAvailable) {
    return []
  }

  const { data, error } = await supabase
    .from('question_enrichments')
    .select(`
      *,
      topic:content_topics(*)
    `)
    .in('status', ['active', 'flagged', 'overridden'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Falha ao carregar enriquecimentos recentes: ${error.message}`)
  }

  return ((data ?? []) as QuestionEnrichmentRow[]).map(questionEnrichmentFromRow)
}

export async function loadOpenQuestionEnrichmentAudits(
  limit = 10,
): Promise<QuestionEnrichmentAudit[]> {
  const semanticCoreAvailable = await loadSemanticCoreAvailability()
  if (!semanticCoreAvailable) {
    return []
  }

  const { data, error } = await supabase
    .from('question_enrichment_audits')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Falha ao carregar auditorias do GLiNER: ${error.message}`)
  }

  return ((data ?? []) as QuestionEnrichmentAuditRow[]).map(questionEnrichmentAuditFromRow)
}

export async function createContentTopic(input: {
  areaSigla: string
  subjectLabel: string
  topicLabel: string
  canonicalLabel: string
}): Promise<ContentTopic> {
  const environment = await loadMentorEnvironmentStatus()
  if (!environment.taxonomyAvailable) {
    throw new Error('Taxonomia do mentor indisponível neste ambiente.')
  }

  const payload = {
    area_sigla: input.areaSigla.trim().toUpperCase(),
    subject_label: input.subjectLabel.trim(),
    topic_label: input.topicLabel.trim(),
    canonical_label: input.canonicalLabel.trim(),
    is_active: true,
    origin_source_context: 'production',
    origin_source_reference: 'manual:gliner-ops',
  }

  const { data, error } = await supabase
    .from('content_topics')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Falha ao criar tópico canônico: ${error.message}`)
  }

  const topic = contentTopicFromRow(data as ContentTopicRow)
  logAudit('create_content_topic', 'content_topic', topic.id, {
    canonicalLabel: topic.canonicalLabel,
    areaSigla: topic.areaSigla,
  })
  return topic
}

async function fetchPlan(planId: string): Promise<MentorPlanSummary> {
  const { data, error } = await supabase
    .from('mentor_plans')
    .select(`
      *,
      items:mentor_plan_items(
        *,
        topic:content_topics(*)
      )
    `)
    .eq('id', planId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Plano do mentor não encontrado.')
  }

  return mapMentorPlan(data as MentorPlanSelectRow)
}

export async function loadMentorPlan(planId: string): Promise<MentorPlanSummary> {
  return fetchPlan(planId)
}

function extractExamQuestionPairs(
  simulado: SimuladoResult,
): Array<{ examId: string; questionNumber: number }> {
  return simulado.wrongQuestions.map((question) => ({
    examId: question.examId ?? simulado.exam.id,
    questionNumber: question.questionNumber,
  }))
}

async function fetchApprovedMappingsForPairs(
  pairs: ReadonlyArray<{ examId: string; questionNumber: number }>,
): Promise<ExamQuestionTopic[]> {
  const examIds = [...new Set(pairs.map((pair) => pair.examId))]
  const questionNumbers = [...new Set(pairs.map((pair) => pair.questionNumber))]

  if (examIds.length === 0 || questionNumbers.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('exam_question_topics')
    .select(`
      *,
      topic:content_topics(*)
    `)
    .eq('is_active', true)
    .in('exam_id', examIds)
    .in('question_number', questionNumbers)
    .eq('review_status', 'approved')

  if (error) {
    throw new Error(`Falha ao buscar mapeamentos aprovados: ${error.message}`)
  }

  const validPairs = new Set(pairs.map((pair) => `${pair.examId}:${pair.questionNumber}`))
  return ((data as ExamQuestionTopicRow[] | null) ?? [])
    .filter((row) => validPairs.has(`${row.exam_id}:${row.question_number}`))
    .map(examQuestionTopicFromRow)
}

async function fetchApprovedMappingsForPairsSafe(
  pairs: ReadonlyArray<{ examId: string; questionNumber: number }>,
): Promise<{
  mappings: ExamQuestionTopic[]
  coverage: TaxonomyCoverageScore
}> {
  const totalPairs = new Set(pairs.map((pair) => `${pair.examId}:${pair.questionNumber}`)).size

  if (totalPairs === 0) {
    return {
      mappings: [],
      coverage: computeCoverageScore(0, []),
    }
  }

  try {
    const mappings = await fetchApprovedMappingsForPairs(pairs)
    return {
      mappings,
      coverage: computeCoverageScore(totalPairs, mappings),
    }
  } catch (error) {
    if (error instanceof Error && isSchemaCacheMissing(error.message)) {
      return {
        mappings: [],
        coverage: computeCoverageScore(totalPairs, []),
      }
    }
    throw error
  }
}

function groupTopicCandidates(
  mappings: ReadonlyArray<ExamQuestionTopic>,
): Array<{ topic: ContentTopic; count: number }> {
  const grouped = new Map<string, { topic: ContentTopic; count: number }>()

  for (const mapping of mappings) {
    if (!mapping.topic) continue
    const existing = grouped.get(mapping.topicId ?? '')
    if (existing) {
      existing.count += 1
    } else if (mapping.topicId) {
      grouped.set(mapping.topicId, { topic: mapping.topic, count: 1 })
    }
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.count !== right.count) return right.count - left.count
    return left.topic.canonicalLabel.localeCompare(right.topic.canonicalLabel)
  })
}

function buildMappedPlanSeeds(
  topicCandidates: ReadonlyArray<{ topic: ContentTopic; count: number }>,
): PlanItemSeed[] {
  return topicCandidates.map((entry) => ({
    topicId: entry.topic.id,
    topic: entry.topic,
    fallbackLabel: buildFallbackLabelFromTopic(entry.topic),
    fallbackAreaSigla: entry.topic.areaSigla,
    fallbackHabilidade: null,
    expectedLevel: 'recover',
    source: 'auto',
    notes: `${entry.count} questão(ões) erradas com mapeamento aprovado.`,
  }))
}

function buildFallbackPlanSeedsFromReport(
  report: ReportData | null | undefined,
): PlanItemSeed[] {
  if (!report) return []

  const unique = new Map<string, PlanItemSeed>()
  const ordered = [...report.questoesRecomendadas.habilidadesCriticas].sort(
    (left, right) => right.score - left.score,
  )

  for (const habilidade of ordered) {
    const fallbackLabel = habilidade.pedagogicalLabel
    const key = `${habilidade.area}:${habilidade.numeroHabilidade}:${fallbackLabel}`
    if (unique.has(key)) continue

    unique.set(key, {
      topicId: null,
      topic: null,
      fallbackLabel,
      fallbackAreaSigla: habilidade.area,
      fallbackHabilidade: habilidade.numeroHabilidade,
      expectedLevel: 'recover',
      source: 'auto',
      notes: `${habilidade.totalErros} erro(s) na habilidade ${habilidade.identificador}.`,
    })
  }

  return [...unique.values()]
}

function buildFallbackPlanSeedsFromSimulado(
  simulado: SimuladoResult,
): PlanItemSeed[] {
  const grouped = new Map<string, { label: string; count: number }>()

  for (const question of simulado.wrongQuestions) {
    const label = question.topic?.trim()
    if (!label) continue
    const current = grouped.get(label)
    if (current) {
      current.count += 1
    } else {
      grouped.set(label, { label, count: 1 })
    }
  }

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count)
    .map((entry) => ({
      topicId: null,
      topic: null,
      fallbackLabel: entry.label,
      fallbackAreaSigla: null,
      fallbackHabilidade: null,
      expectedLevel: 'recover',
      source: 'auto',
      notes: `${entry.count} erro(s) no tópico reportado pelo simulado.`,
    }))
}

function combinePlanSeeds(params: {
  mappedSeeds: ReadonlyArray<PlanItemSeed>
  fallbackSeeds: ReadonlyArray<PlanItemSeed>
  mode: PlanGenerationMode
  limit?: number
}): PlanItemSeed[] {
  const limit = params.limit ?? 8
  const unique = new Map<string, PlanItemSeed>()

  const addSeed = (seed: PlanItemSeed) => {
    const key =
      seed.topicId ??
      `${seed.fallbackAreaSigla ?? 'OUT'}:${seed.fallbackHabilidade ?? 'SEM_HAB'}:${seed.fallbackLabel ?? 'SEM_LABEL'}`

    if (!unique.has(key)) {
      unique.set(key, seed)
    }
  }

  if (params.mode === 'taxonomy_complete') {
    params.mappedSeeds.forEach(addSeed)
    return [...unique.values()].slice(0, limit)
  }

  params.mappedSeeds.forEach(addSeed)
  params.fallbackSeeds.forEach(addSeed)

  if (params.mode === 'fallback_guided' && params.fallbackSeeds.length > 0) {
    unique.clear()
    params.fallbackSeeds.forEach(addSeed)
  }

  return [...unique.values()].slice(0, limit)
}

function buildPreviewPlanSummary(params: {
  schoolId: string
  mentorUserId: string
  studentKey: string
  weekStart: string
  weekEnd: string
  notes: string | null
  mode: PlanGenerationMode
  capabilityState: MentorCapabilityState
  taxonomySourceKind: TaxonomySourceKind
  coverage: TaxonomyCoverageScore
  items: ReadonlyArray<PlanItemSeed>
}): MentorPlanSummary {
  const now = new Date().toISOString()

  return {
    id: `preview-${crypto.randomUUID()}`,
    schoolId: params.schoolId,
    mentorUserId: params.mentorUserId,
    targetType: 'student',
    studentKey: params.studentKey,
    turma: null,
    weekStart: params.weekStart,
    weekEnd: params.weekEnd,
    source: 'auto_button',
    status: 'draft',
    capabilityState: params.capabilityState,
    generationMode: params.mode,
    taxonomySourceKind: params.taxonomySourceKind,
    coverageScore: params.coverage,
    isPreviewOnly: params.mode === 'preview_only',
    pdfHistoryId: null,
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
    items: params.items.map((item, index) => ({
      id: `preview-item-${index + 1}`,
      mentorPlanId: 'preview',
      topicId: item.topicId,
      fallbackLabel: item.fallbackLabel,
      fallbackAreaSigla: item.fallbackAreaSigla,
      fallbackHabilidade: item.fallbackHabilidade,
      plannedOrder: index,
      expectedLevel: item.expectedLevel,
      source: item.source,
      notes: item.notes,
      createdAt: now,
      topic: item.topic,
    })),
  }
}

async function persistMentorPlan(
  input: MentorPlanCreationInput,
): Promise<MentorPlanSummary> {
  const { data: insertedPlan, error: insertPlanError } = await supabase
    .from('mentor_plans')
    .insert({
      school_id: input.schoolId,
      mentor_user_id: input.mentorUserId,
      target_type: 'student',
      student_key: input.studentKey,
      week_start: input.weekStart,
      week_end: input.weekEnd,
      source: 'auto_button',
      status: 'draft',
      capability_state: input.capabilityState ?? 'ready',
      generation_mode: input.generationMode ?? 'taxonomy_complete',
      taxonomy_source_kind: input.taxonomySourceKind ?? 'none',
      mapped_pairs: input.mappedPairs ?? 0,
      total_pairs: input.totalPairs ?? 0,
      coverage_percent: input.coveragePercent ?? 0,
      distinct_topics: input.distinctTopics ?? 0,
      notes: input.notes ?? null,
    })
    .select('*')
    .single()

  if (insertPlanError || !insertedPlan) {
    throw new Error(`Falha ao criar plano do mentor: ${insertPlanError?.message}`)
  }

  if (input.items.length > 0) {
    const { error: insertItemsError } = await supabase
      .from('mentor_plan_items')
      .insert(
        input.items.map((item, index) => ({
          mentor_plan_id: insertedPlan.id,
          topic_id: item.topicId ?? null,
          fallback_label: item.fallbackLabel ?? null,
          fallback_area_sigla: item.fallbackAreaSigla ?? null,
          fallback_habilidade: item.fallbackHabilidade ?? null,
          planned_order: index,
          expected_level: item.expectedLevel,
          source: item.source ?? 'auto',
          notes: item.notes ?? null,
        })),
      )

    if (insertItemsError) {
      throw new Error(`Falha ao criar itens do plano: ${insertItemsError.message}`)
    }
  }

  return fetchPlan(insertedPlan.id)
}

function shouldFallbackToPreview(error: unknown): boolean {
  return error instanceof Error && isSchemaCacheMissing(error.message)
}

export async function createDraftMentorPlanFromSimulado(params: {
  simulado: SimuladoResult
  report?: ReportData | null
  student: {
    id?: string | null
    matricula?: string | null
    escola?: string | null
  }
  notes?: string | null
}): Promise<MentorPlanSummary> {
  const [projectUser, environment] = await Promise.all([
    getCurrentProjectUser(),
    loadMentorEnvironmentStatus(),
  ])
  const studentKey = buildStudentKey({
    matricula: params.student.matricula ?? params.simulado.studentAnswer.student_number,
    studentId: params.student.id ?? null,
    isAvulso: params.student.escola === 'XTRI' && !!params.student.id,
  })
  const weekBounds = getCurrentWeekBounds()
  const examPairs = extractExamQuestionPairs(params.simulado)
  const { mappings, coverage } = environment.taxonomyAvailable
    ? await fetchApprovedMappingsForPairsSafe(examPairs)
    : {
        mappings: [],
        coverage: computeCoverageScore(
          new Set(examPairs.map((pair) => `${pair.examId}:${pair.questionNumber}`)).size,
          [],
        ),
      }

  const effectiveCoverage = mergeCapabilityWithCoverage(environment, coverage)
  const mode = resolvePlanGenerationMode(effectiveCoverage.state)
  const taxonomySourceKind = resolveTaxonomySourceKind(mappings)
  const mappedSeeds = buildMappedPlanSeeds(groupTopicCandidates(mappings))
  const fallbackSeeds = buildFallbackPlanSeedsFromReport(params.report).length > 0
    ? buildFallbackPlanSeedsFromReport(params.report)
    : buildFallbackPlanSeedsFromSimulado(params.simulado)
  const items = combinePlanSeeds({
    mappedSeeds,
    fallbackSeeds,
    mode,
  })

  const resolvedSchoolId =
    environment.coreAvailable
      ? await resolveTargetSchoolId({
          projectUser,
          student: params.student,
        })
      : (projectUser.schoolId ?? 'preview-local')

  const defaultNotes = params.notes ?? `Plano gerado a partir do simulado ${params.simulado.exam.title}.`
  const capabilityNote =
    mode === 'fallback_guided'
      ? 'fallback_sem_taxonomia_aprovada'
      : mode === 'hybrid'
        ? 'fallback_parcial_com_taxonomia'
        : mode === 'preview_only'
          ? 'preview_local_modulo_mentor_indisponivel'
          : null
  const notes = [defaultNotes, capabilityNote].filter(Boolean).join(' | ')

  if (!environment.coreAvailable) {
    return buildPreviewPlanSummary({
      schoolId: resolvedSchoolId,
      mentorUserId: projectUser.userId,
      studentKey,
      weekStart: weekBounds.weekStart,
      weekEnd: weekBounds.weekEnd,
      notes,
      mode,
      capabilityState: effectiveCoverage.state,
      taxonomySourceKind,
      coverage: effectiveCoverage,
      items,
    })
  }

  try {
    const plan = await persistMentorPlan({
      schoolId: resolvedSchoolId,
      mentorUserId: projectUser.userId,
      studentKey,
      weekStart: weekBounds.weekStart,
      weekEnd: weekBounds.weekEnd,
      capabilityState: effectiveCoverage.state,
      generationMode: mode,
      taxonomySourceKind,
      mappedPairs: effectiveCoverage.mappedPairs,
      totalPairs: effectiveCoverage.totalPairs,
      coveragePercent: effectiveCoverage.coveragePercent,
      distinctTopics: effectiveCoverage.distinctTopics,
      notes,
      items: items.map((item) => ({
        topicId: item.topicId,
        fallbackLabel: item.fallbackLabel,
        fallbackAreaSigla: item.fallbackAreaSigla,
        fallbackHabilidade: item.fallbackHabilidade,
        expectedLevel: item.expectedLevel,
        source: item.source,
        notes: item.notes,
      })),
    })

    logAudit('create_mentor_plan', 'mentor_plan', plan.id, {
      studentKey,
      topicCount: plan.items.length,
      source: 'auto_button',
      capabilityState: plan.capabilityState,
      generationMode: plan.generationMode,
      coveragePercent: plan.coverageScore.coveragePercent,
      taxonomySourceKind: plan.taxonomySourceKind,
    })

    return plan
  } catch (error) {
    if (!shouldFallbackToPreview(error)) {
      throw error
    }

    const previewCoverage: TaxonomyCoverageScore = {
      ...effectiveCoverage,
      state: 'core_missing',
    }

    return buildPreviewPlanSummary({
      schoolId: resolvedSchoolId,
      mentorUserId: projectUser.userId,
      studentKey,
      weekStart: weekBounds.weekStart,
      weekEnd: weekBounds.weekEnd,
      notes: `${notes} | preview_local_modulo_mentor_indisponivel`,
      mode: 'preview_only',
      capabilityState: 'core_missing',
      taxonomySourceKind,
      coverage: previewCoverage,
      items,
    })
  }
}

export async function updateMentorPlanItem(
  itemId: string,
  updates: Pick<MentorPlanItem, 'expectedLevel' | 'notes'>,
): Promise<void> {
  const { error } = await supabase
    .from('mentor_plan_items')
    .update({
      expected_level: updates.expectedLevel,
      notes: updates.notes,
    })
    .eq('id', itemId)

  if (error) {
    throw new Error(`Falha ao atualizar item do plano: ${error.message}`)
  }

  logAudit('update_mentor_plan', 'mentor_plan_item', itemId, {
    expectedLevel: updates.expectedLevel,
  })
}

export async function deleteMentorPlanItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('mentor_plan_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    throw new Error(`Falha ao remover item do plano: ${error.message}`)
  }

  logAudit('update_mentor_plan', 'mentor_plan_item', itemId, {
    action: 'delete',
  })
}

export async function addMentorPlanItem(params: {
  mentorPlanId: string
  topicId: string
  expectedLevel: MentorPlanItem['expectedLevel']
  notes?: string | null
}): Promise<void> {
  const plan = await fetchPlan(params.mentorPlanId)
  const lastOrder = plan.items.reduce(
    (maxOrder, item) => Math.max(maxOrder, item.plannedOrder),
    -1,
  )

  const { error } = await supabase
    .from('mentor_plan_items')
    .insert({
      mentor_plan_id: params.mentorPlanId,
      topic_id: params.topicId,
      planned_order: lastOrder + 1,
      expected_level: params.expectedLevel,
      source: 'manual',
      notes: params.notes ?? null,
    })

  if (error) {
    throw new Error(`Falha ao adicionar item no plano: ${error.message}`)
  }

  logAudit('update_mentor_plan', 'mentor_plan', params.mentorPlanId, {
    action: 'add_item',
    topicId: params.topicId,
  })
}

export async function sendMentorPlan(planId: string): Promise<void> {
  const plan = await fetchPlan(planId)

  if (!plan.studentKey) {
    throw new Error('Somente planos individuais podem ser enviados neste V1.')
  }

  const { error: supersedeError } = await supabase
    .from('mentor_plans')
    .update({ status: 'superseded' })
    .eq('school_id', plan.schoolId)
    .eq('student_key', plan.studentKey)
    .eq('week_start', plan.weekStart)
    .eq('week_end', plan.weekEnd)
    .eq('status', 'sent')
    .neq('id', plan.id)

  if (supersedeError) {
    throw new Error(`Falha ao superseder planos anteriores: ${supersedeError.message}`)
  }

  const { error } = await supabase
    .from('mentor_plans')
    .update({
      status: 'sent',
      updated_at: new Date().toISOString(),
    })
    .eq('id', plan.id)

  if (error) {
    throw new Error(`Falha ao enviar plano do mentor: ${error.message}`)
  }

  logAudit('send_mentor_plan', 'mentor_plan', plan.id, {
    studentKey: plan.studentKey,
  })

  await runMentorGapAnalysis(plan.id)
}

function parseQuestionContents(
  payload: unknown,
): QuestionContent[] {
  if (!Array.isArray(payload)) return []
  return payload as QuestionContent[]
}

function buildQuestionRecordsFromExam(params: {
  examId: string
  assessedAt: string
  answers: string[]
  questionContents: QuestionContent[]
  answerKey: string[] | null
}): RawPerformanceRecord[] {
  if (params.questionContents.length === 0) {
    return (params.answerKey ?? []).map((correctAnswer, index) => ({
      examId: params.examId,
      assessedAt: params.assessedAt,
      questionNumber: index + 1,
      correct: (params.answers[index] ?? '') === correctAnswer,
    }))
  }

  const firstQuestionNumber = params.questionContents[0]?.questionNumber ?? 1

  return params.questionContents.map((question) => {
    const answerIndex = question.questionNumber - firstQuestionNumber
    const studentAnswer = params.answers[answerIndex] ?? ''
    const correctAnswer =
      question.answer ?? params.answerKey?.[answerIndex] ?? ''

    return {
      examId: params.examId,
      assessedAt: params.assessedAt,
      questionNumber: question.questionNumber,
      correct: studentAnswer === correctAnswer,
    }
  })
}

async function fetchStudentAnswersPerformance(
  studentKey: string,
  startDateIso: string,
): Promise<RawPerformanceRecord[]> {
  const candidates = buildStudentNumberCandidates(studentKey)
  if (candidates.length === 0) return []

  const { data: answers, error } = await simuladoSupabase
    .from('student_answers')
    .select('id, exam_id, student_number, answers, created_at')
    .in('student_number', candidates)
    .gte('created_at', startDateIso)
    .order('created_at', { ascending: false })

  if (error || !answers || answers.length === 0) {
    return []
  }

  const examIds = [...new Set(answers.map((answer) => answer.exam_id as string))]
  const { data: exams } = await simuladoSupabase
    .from('exams')
    .select('id, answer_key, question_contents')
    .in('id', examIds)

  const examsById = new Map(
    ((exams ?? []) as Array<{
      id: string
      answer_key: string[] | null
      question_contents: QuestionContent[] | null
    }>).map((exam) => [exam.id, exam]),
  )

  return ((answers ?? []) as Array<{
    exam_id: string
    answers: string[]
    created_at: string
  }>).flatMap((answer) => {
    const exam = examsById.get(answer.exam_id)
    if (!exam) return []

    return buildQuestionRecordsFromExam({
      examId: answer.exam_id,
      assessedAt: answer.created_at,
      answers: answer.answers ?? [],
      questionContents: parseQuestionContents(exam.question_contents),
      answerKey: exam.answer_key,
    })
  })
}

function isMatchingProjetoStudent(
  student: ProjetoStudent,
  studentKey: string,
): boolean {
  const parsed = parseStudentKey(studentKey)
  if (parsed.kind === 'avulso') return false

  const candidates = [
    student.matricula,
    student.student_number,
    student.studentNumber,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())

  return candidates.includes(parsed.value)
}

async function fetchProjetosPerformance(
  studentKey: string,
  startDateIso: string,
): Promise<RawPerformanceRecord[]> {
  const parsed = parseStudentKey(studentKey)
  if (parsed.kind === 'avulso') return []

  const { data: projetos, error } = await simuladoSupabase
    .from('projetos')
    .select('id, created_at, answer_key, question_contents, students')
    .gte('created_at', startDateIso)
    .order('created_at', { ascending: false })

  if (error || !projetos || projetos.length === 0) {
    return []
  }

  const rows = (projetos as ProjetoRow[]).flatMap((projeto) => {
    const student = (projeto.students ?? []).find((entry) =>
      isMatchingProjetoStudent(entry, studentKey),
    )
    if (!student?.answers || !projeto.answer_key) return []

    return buildQuestionRecordsFromExam({
      examId: projeto.id,
      assessedAt: projeto.created_at,
      answers: student.answers,
      questionContents: parseQuestionContents(projeto.question_contents),
      answerKey: projeto.answer_key,
    })
  })

  return rows
}

async function fetchApprovedMappingsForRecords(
  records: ReadonlyArray<RawPerformanceRecord>,
): Promise<ExamQuestionTopic[]> {
  const pairs = records.map((record) => ({
    examId: record.examId,
    questionNumber: record.questionNumber,
  }))

  const { mappings } = await fetchApprovedMappingsForPairsSafe(pairs)
  return mappings
}

async function buildAuditInputFromClient(
  plan: MentorPlanSummary,
): Promise<{
  records: TopicPerformanceRecord[]
  mappedQuestionsCount: number
  unmappedQuestionsCount: number
  previousPlanTopicIds: string[][]
}> {
  const now = Date.now()
  const startDateIso = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()
  const rawRecordsFromAnswers = await fetchStudentAnswersPerformance(
    plan.studentKey ?? '',
    startDateIso,
  )
  const rawRecords =
    rawRecordsFromAnswers.length > 0
      ? rawRecordsFromAnswers
      : await fetchProjetosPerformance(plan.studentKey ?? '', startDateIso)

  const mappings = await fetchApprovedMappingsForRecords(rawRecords)
  const mappingsByPair = new Map(
    mappings.map((mapping) => [
      `${mapping.examId}:${mapping.questionNumber}`,
      mapping,
    ]),
  )

  const records = rawRecords.flatMap<TopicPerformanceRecord>((record) => {
    const mapping = mappingsByPair.get(`${record.examId}:${record.questionNumber}`)
    if (!mapping?.topic || !mapping.topicId) {
      return []
    }

    return [{
      topicId: mapping.topicId,
      canonicalLabel: mapping.topic.canonicalLabel,
      areaSigla: mapping.topic.areaSigla,
      examId: record.examId,
      assessedAt: record.assessedAt,
      questionNumber: record.questionNumber,
      correct: record.correct,
      difficulty: null,
    }]
  })

  const { data: previousPlans } = await supabase
    .from('mentor_plans')
    .select(`
      id,
      items:mentor_plan_items(topic_id)
    `)
    .eq('school_id', plan.schoolId)
    .eq('student_key', plan.studentKey)
    .eq('status', 'sent')
    .neq('id', plan.id)
    .order('week_start', { ascending: false })
    .limit(2)

  const previousPlanTopicIds =
    ((previousPlans ?? []) as Array<{ items?: Array<{ topic_id: string }> | null }>)
      .map((prevPlan) => (prevPlan.items ?? []).map((item) => item.topic_id))

  return {
    records,
    mappedQuestionsCount: records.length,
    unmappedQuestionsCount: Math.max(0, rawRecords.length - records.length),
    previousPlanTopicIds,
  }
}

async function persistAudit(
  plan: MentorPlanSummary,
  audit: StudentPerformanceAudit,
): Promise<StudentPerformanceAudit> {
  await supabase
    .from('mentor_alerts')
    .update({
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('school_id', plan.schoolId)
    .eq('student_key', plan.studentKey ?? '')
    .in('status', ['active', 'acknowledged'])

  const { data: runRow, error: runError } = await supabase
    .from('mentor_analysis_runs')
    .insert({
      mentor_plan_id: plan.id,
      school_id: plan.schoolId,
      student_key: plan.studentKey,
      overall_status: audit.overallStatus,
      briefing: audit.briefing.summary,
      avg_mastery_planned: average(
        audit.plannedTopics.map((topic) => topic.masteryScore),
      ),
      avg_mastery_critical: average(
        audit.criticalTopics.map((topic) => topic.masteryScore),
      ),
      unmapped_questions_count: audit.coverageMetrics.unmappedQuestionsCount,
    })
    .select('*')
    .single()

  if (runError || !runRow) {
    throw new Error(`Falha ao persistir análise do mentor: ${runError?.message}`)
  }

  if (audit.alerts.length > 0) {
    const { error: alertsError } = await supabase
      .from('mentor_alerts')
      .insert(
        audit.alerts.map((alert) => ({
          analysis_run_id: runRow.id,
          school_id: audit.schoolId,
          student_key: audit.studentKey,
          topic_id: alert.topicId,
          alert_type: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          evidence: alert.evidence,
          status: alert.status,
        })),
      )

    if (alertsError) {
      throw new Error(`Falha ao persistir alertas: ${alertsError.message}`)
    }
  }

  const { data: persistedAlerts } = await supabase
    .from('mentor_alerts')
    .select(`
      *,
      topic:content_topics(*)
    `)
    .eq('analysis_run_id', runRow.id)
    .order('created_at', { ascending: true })

  logAudit('run_gap_analysis', 'mentor_plan', plan.id, {
    studentKey: plan.studentKey,
    overallStatus: audit.overallStatus,
    alertCount: audit.alerts.length,
  })

  return {
    ...audit,
    analyzedAt: runRow.analyzed_at,
    alerts: ((persistedAlerts ?? []) as MentorAlertRow[]).map((alert) => ({
      id: alert.id,
      analysisRunId: alert.analysis_run_id,
      schoolId: alert.school_id,
      studentKey: alert.student_key,
      topicId: alert.topic_id,
      topicLabel: alert.topic?.canonical_label ?? null,
      alertType: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
      evidence: alert.evidence,
      status: alert.status,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at,
    })),
  }
}

function buildPlanTopicRefs(plan: MentorPlanSummary): PlanTopicRef[] {
  return plan.items
    .filter((item): item is MentorPlanItem & { topicId: string; topic: ContentTopic } =>
      Boolean(item.topic && item.topicId),
    )
    .map((item) => ({
      topicId: item.topicId,
      canonicalLabel: item.topic.canonicalLabel,
      areaSigla: item.topic.areaSigla,
      plannedOrder: item.plannedOrder,
    }))
}

export async function runMentorGapAnalysis(
  planId: string,
): Promise<StudentPerformanceAudit> {
  const plan = await fetchPlan(planId)

  if (!plan.studentKey) {
    throw new Error('A análise do mentor V1 exige plano individual.')
  }

  // Na sessão do mentor, o fallback local evita ruído de rede e mantém a UX estável.
  if (typeof window !== 'undefined') {
    const clientInput = await buildAuditInputFromClient(plan)
    const audit = buildStudentPerformanceAudit({
      mentorPlanId: plan.id,
      schoolId: plan.schoolId,
      studentKey: plan.studentKey,
      planTopics: buildPlanTopicRefs(plan),
      previousPlanTopicIds: clientInput.previousPlanTopicIds,
      records: clientInput.records,
      mappedQuestionsCount: clientInput.mappedQuestionsCount,
      unmappedQuestionsCount: clientInput.unmappedQuestionsCount,
    })

    return persistAudit(plan, audit)
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { data, error } = await supabase.functions.invoke('mentor-gap-analysis', {
    headers: session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : undefined,
    body: {
      school_id: plan.schoolId,
      student_key: plan.studentKey,
      mentor_plan_id: plan.id,
      window_days: 90,
      reference_date: plan.weekStart,
    },
  })

  if (!error && data?.audit) {
    return data.audit as StudentPerformanceAudit
  }

  const clientInput = await buildAuditInputFromClient(plan)
  const audit = buildStudentPerformanceAudit({
    mentorPlanId: plan.id,
    schoolId: plan.schoolId,
    studentKey: plan.studentKey,
    planTopics: buildPlanTopicRefs(plan),
    previousPlanTopicIds: clientInput.previousPlanTopicIds,
    records: clientInput.records,
    mappedQuestionsCount: clientInput.mappedQuestionsCount,
    unmappedQuestionsCount: clientInput.unmappedQuestionsCount,
  })

  return persistAudit(plan, audit)
}

async function resolveStudentIdentities(
  studentKeys: ReadonlyArray<string>,
): Promise<Map<string, StudentIdentity>> {
  const parsed = studentKeys.map((key) => ({ key, parsed: parseStudentKey(key) }))
  const matriculas = parsed
    .filter((entry) => entry.parsed.kind === 'matricula')
    .map((entry) => entry.parsed.value)
  const avulsoIds = parsed
    .filter((entry) => entry.parsed.kind === 'avulso')
    .map((entry) => entry.parsed.value)

  const [studentsRes, avulsosRes, schoolsRes] = await Promise.all([
    matriculas.length > 0
      ? supabase
          .from('students')
          .select('matricula, name, turma, school_id')
          .in('matricula', matriculas)
      : Promise.resolve({ data: [] }),
    avulsoIds.length > 0
      ? supabase
          .from('alunos_avulsos_cronograma')
          .select('id, nome, matricula, turma')
          .in('id', avulsoIds)
      : Promise.resolve({ data: [] }),
    supabase.from('schools').select('id, name'),
  ])

  const schoolMap = new Map(
    (((schoolsRes.data ?? []) as Array<{ id: string; name: string }>)).map((school) => [
      school.id,
      school.name,
    ]),
  )

  const identities = new Map<string, StudentIdentity>()

  for (const student of (studentsRes.data ?? []) as Array<{
    matricula: string
    name: string | null
    turma: string | null
    school_id: string | null
  }>) {
    identities.set(student.matricula, {
      studentName: student.name ?? 'Aluno sem nome',
      matricula: student.matricula,
      turma: student.turma ?? '-',
      schoolName: student.school_id ? (schoolMap.get(student.school_id) ?? null) : null,
    })
  }

  for (const avulso of (avulsosRes.data ?? []) as Array<{
    id: string
    nome: string | null
    matricula: string | null
    turma: string | null
  }>) {
    identities.set(`avulso:${avulso.id}`, {
      studentName: avulso.nome ?? 'Aluno avulso',
      matricula: avulso.matricula ?? avulso.id,
      turma: avulso.turma ?? '-',
      schoolName: 'Aluno Avulso',
    })
  }

  return identities
}

export async function loadPerformanceOverview(filters?: {
  schoolId?: string
  turma?: string
  status?: PerformanceOverviewItem['overallStatus']
  weekStart?: string
}): Promise<PerformanceOverviewItem[]> {
  const [projectUser, environment] = await Promise.all([
    getCurrentProjectUser(),
    loadMentorEnvironmentStatus(),
  ])

  if (!environment.coreAvailable) {
    return []
  }

  const schoolId =
    projectUser.role === 'super_admin'
      ? filters?.schoolId
      : projectUser.schoolId

  let query = supabase
    .from('mentor_plans')
    .select('*')
    .eq('target_type', 'student')
    .in('status', ['draft', 'sent'])
    .order('updated_at', { ascending: false })

  if (schoolId) {
    query = query.eq('school_id', schoolId)
  }
  if (filters?.weekStart) {
    query = query.eq('week_start', filters.weekStart)
  }

  const { data: plans, error } = await query

  if (error) {
    throw new Error(`Falha ao carregar planos do mentor: ${error.message}`)
  }

  const latestPlanByStudent = new Map<string, MentorPlanRow>()
  for (const plan of ((plans ?? []) as MentorPlanRow[])) {
    if (!plan.student_key || latestPlanByStudent.has(plan.student_key)) continue
    latestPlanByStudent.set(plan.student_key, plan)
  }

  const latestPlans = [...latestPlanByStudent.values()]
  const planIds = latestPlans.map((plan) => plan.id)
  const studentKeys = latestPlans
    .map((plan) => plan.student_key)
    .filter((value): value is string => Boolean(value))

  const [analysisRunsRes, identities] = await Promise.all([
    planIds.length > 0
      ? supabase
          .from('mentor_analysis_runs')
          .select('*')
          .in('mentor_plan_id', planIds)
          .order('analyzed_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    resolveStudentIdentities(studentKeys),
  ])

  const latestRunByPlan = new Map<string, {
    id: string
    overall_status: PerformanceOverviewItem['overallStatus']
    briefing: string
    analyzed_at: string
  }>()

  for (const run of (analysisRunsRes.data ?? []) as Array<{
    id: string
    mentor_plan_id: string
    overall_status: PerformanceOverviewItem['overallStatus']
    briefing: string
    analyzed_at: string
  }>) {
    if (!latestRunByPlan.has(run.mentor_plan_id)) {
      latestRunByPlan.set(run.mentor_plan_id, {
        id: run.id,
        overall_status: run.overall_status,
        briefing: run.briefing,
        analyzed_at: run.analyzed_at,
      })
    }
  }

  const runIds = [...latestRunByPlan.values()].map((run) => run.id)
  const { data: alertsData } =
    runIds.length > 0
      ? await supabase
          .from('mentor_alerts')
          .select('analysis_run_id, severity')
          .in('analysis_run_id', runIds)
      : { data: [] as Array<{ analysis_run_id: string; severity: string }> }

  const alertCountsByRun = new Map<string, { total: number; critical: number }>()
  for (const alert of (alertsData ?? []) as Array<{
    analysis_run_id: string
    severity: string
  }>) {
    const entry = alertCountsByRun.get(alert.analysis_run_id) ?? {
      total: 0,
      critical: 0,
    }
    entry.total += 1
    if (alert.severity === 'critical') entry.critical += 1
    alertCountsByRun.set(alert.analysis_run_id, entry)
  }

  const statusRank: Record<PerformanceOverviewItem['overallStatus'], number> = {
    vermelho: 0,
    amarelo: 1,
    verde: 2,
    sem_dados: 3,
  }

  return latestPlans
    .map((plan) => {
      const identity = plan.student_key
        ? identities.get(plan.student_key)
        : undefined
      const latestRun = latestRunByPlan.get(plan.id)
      const alertCount = latestRun ? (alertCountsByRun.get(latestRun.id)?.total ?? 0) : 0
      const criticalAlertCount = latestRun
        ? (alertCountsByRun.get(latestRun.id)?.critical ?? 0)
        : 0

      return {
        planId: plan.id,
        studentKey: plan.student_key ?? '',
        studentName: identity?.studentName ?? plan.student_key ?? 'Aluno sem identificação',
        matricula: identity?.matricula ?? plan.student_key ?? '-',
        turma: identity?.turma ?? plan.turma ?? '-',
        schoolId: plan.school_id,
        schoolName: identity?.schoolName ?? null,
        planStatus: plan.status,
        capabilityState: plan.capability_state,
        generationMode: plan.generation_mode,
        taxonomySourceKind: plan.taxonomy_source_kind,
        coveragePercent: plan.coverage_percent,
        coverageState: plan.capability_state,
        overallStatus: latestRun?.overall_status ?? 'sem_dados',
        alertCount,
        criticalAlertCount,
        weekStart: plan.week_start,
        weekEnd: plan.week_end,
        briefing: latestRun?.briefing ?? null,
        analyzedAt: latestRun?.analyzed_at ?? null,
        updatedAt: plan.updated_at,
      }
    })
    .filter((item) => !filters?.turma || item.turma === filters.turma)
    .filter((item) => !filters?.status || item.overallStatus === filters.status)
    .sort((left, right) => {
      const statusDiff = statusRank[left.overallStatus] - statusRank[right.overallStatus]
      if (statusDiff !== 0) return statusDiff
      return right.updatedAt.localeCompare(left.updatedAt)
    })
}

export async function loadMentorPerformanceDetail(
  planId: string,
): Promise<{ plan: MentorPlanSummary; audit: StudentPerformanceAudit }> {
  const [plan, audit] = await Promise.all([
    fetchPlan(planId),
    runMentorGapAnalysis(planId),
  ])

  return { plan, audit }
}

export async function loadContentTopics(): Promise<ContentTopic[]> {
  const environment = await loadMentorEnvironmentStatus()
  if (!environment.taxonomyAvailable) {
    return []
  }

  const { data, error } = await supabase
    .from('content_topics')
    .select('*')
    .eq('is_active', true)
    .order('canonical_label', { ascending: true })

  if (error) {
    throw new Error(`Falha ao carregar tópicos canônicos: ${error.message}`)
  }

  return ((data ?? []) as ContentTopicRow[]).map(contentTopicFromRow)
}

export async function loadPendingContentMappings(): Promise<ExamQuestionTopic[]> {
  const environment = await loadMentorEnvironmentStatus()
  if (!environment.taxonomyAvailable) {
    return []
  }

  const { data, error } = await supabase
    .from('exam_question_topics')
    .select(`
      *,
      topic:content_topics(*)
    `)
    .eq('is_active', true)
    .eq('review_status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Falha ao carregar fila de mapeamento: ${error.message}`)
  }

  return ((data ?? []) as ExamQuestionTopicRow[]).map(examQuestionTopicFromRow)
}

export async function reviewContentMapping(params: {
  mappingId: string
  topicId: string | null
  reviewStatus: 'approved' | 'rejected'
  confidence?: number | null
  originalTopicId?: string | null
  mappingSource?: ContentMappingSource
}): Promise<void> {
  const environment = await loadMentorEnvironmentStatus()
  if (!environment.taxonomyAvailable) {
    throw new Error('Taxonomia do mentor indisponível neste ambiente.')
  }

  const projectUser = await getCurrentProjectUser()
  let mappingSource: ContentMappingSource = params.mappingSource ?? 'legacy'

  if (params.reviewStatus === 'approved' && params.topicId) {
    const approvedByGliner =
      mappingSource === 'gliner_approved' &&
      params.originalTopicId != null &&
      params.originalTopicId === params.topicId

    mappingSource = approvedByGliner ? 'gliner_approved' : 'manual'
  }

  const { error } = await supabase
    .from('exam_question_topics')
    .update({
      topic_id: params.topicId,
      review_status: params.reviewStatus,
      mapping_source: mappingSource,
      confidence: params.confidence ?? null,
      reviewed_by: projectUser.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.mappingId)
    .eq('is_active', true)

  if (error) {
    throw new Error(`Falha ao revisar mapeamento: ${error.message}`)
  }

  logAudit('review_topic_mapping', 'exam_question_topic', params.mappingId, {
    reviewStatus: params.reviewStatus,
    topicId: params.topicId,
  })
}

export async function submitMentorAlertFeedback(params: {
  alertId: string
  decision: MentorAlertFeedbackDecision
  note?: string | null
}): Promise<void> {
  if (!ALERT_FEEDBACK_DECISIONS.includes(params.decision)) {
    throw new Error('Decisão de feedback inválida.')
  }

  const projectUser = await getCurrentProjectUser()
  const { error } = await supabase
    .from('mentor_alert_feedback')
    .upsert({
      mentor_alert_id: params.alertId,
      mentor_user_id: projectUser.userId,
      decision: params.decision,
      note: params.note ?? null,
    }, {
      onConflict: 'mentor_alert_id,mentor_user_id',
    })

  if (error) {
    throw new Error(`Falha ao registrar feedback do alerta: ${error.message}`)
  }

  await supabase
    .from('mentor_alerts')
    .update({
      status: 'acknowledged',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.alertId)

  logAudit('feedback_alert', 'mentor_alert', params.alertId, {
    decision: params.decision,
  })
}
