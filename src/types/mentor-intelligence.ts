export const CONTENT_MAPPING_SOURCES = [
  'manual',
  'gliner_approved',
  'legacy',
] as const

export type ContentMappingSource = (typeof CONTENT_MAPPING_SOURCES)[number]

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const

export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const EXPECTED_LEVELS = ['recover', 'maintain', 'advance'] as const

export type ExpectedLevel = (typeof EXPECTED_LEVELS)[number]

export const PLAN_STATUSES = ['draft', 'sent', 'superseded', 'archived'] as const

export type MentorPlanStatus = (typeof PLAN_STATUSES)[number]

export const MENTOR_CAPABILITY_STATES = [
  'core_missing',
  'taxonomy_missing',
  'taxonomy_partial',
  'ready',
] as const

export type MentorCapabilityState = (typeof MENTOR_CAPABILITY_STATES)[number]

export const PLAN_GENERATION_MODES = [
  'preview_only',
  'fallback_guided',
  'hybrid',
  'taxonomy_complete',
] as const

export type PlanGenerationMode = (typeof PLAN_GENERATION_MODES)[number]

export const TAXONOMY_SOURCE_CONTEXTS = [
  'production',
  'homologation',
] as const

export type TaxonomySourceContext = (typeof TAXONOMY_SOURCE_CONTEXTS)[number]

export const TAXONOMY_SOURCE_KINDS = [
  'none',
  'homologation',
  'mixed',
  'production',
] as const

export type TaxonomySourceKind = (typeof TAXONOMY_SOURCE_KINDS)[number]

export const ATTENTION_STATUSES = [
  'verde',
  'amarelo',
  'vermelho',
  'sem_dados',
] as const

export type MentorAttentionStatus = (typeof ATTENTION_STATUSES)[number]

export const ALERT_TYPES = [
  'misaligned_plan',
  'not_absorbed',
  'persistent_gap',
  'can_advance',
] as const

export type MentorAlertType = (typeof ALERT_TYPES)[number]

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const

export type MentorAlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_FEEDBACK_DECISIONS = ['agree', 'disagree'] as const

export type MentorAlertFeedbackDecision =
  (typeof ALERT_FEEDBACK_DECISIONS)[number]

export type ContentTopicRow = {
  id: string
  area_sigla: string
  subject_label: string
  topic_label: string
  canonical_label: string
  is_active: boolean
  origin_source_context: TaxonomySourceContext
  origin_source_reference: string | null
  created_at: string
}

export type ExamQuestionTopicRow = {
  id: string
  exam_id: string
  question_number: number
  topic_id: string | null
  mapping_source: ContentMappingSource
  confidence: number | null
  review_status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  is_active: boolean
  source_context: TaxonomySourceContext
  source_reference: string | null
  created_at: string
  topic?: ContentTopicRow | null
}

export type MentorPlanRow = {
  id: string
  school_id: string
  mentor_user_id: string
  target_type: 'student' | 'turma'
  student_key: string | null
  turma: string | null
  week_start: string
  week_end: string
  source: 'auto_button' | 'manual_edit'
  status: MentorPlanStatus
  capability_state: MentorCapabilityState
  generation_mode: PlanGenerationMode
  mapped_pairs: number
  total_pairs: number
  coverage_percent: number
  distinct_topics: number
  taxonomy_source_kind: TaxonomySourceKind
  pdf_history_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MentorPlanItemRow = {
  id: string
  mentor_plan_id: string
  topic_id: string | null
  fallback_label: string | null
  fallback_area_sigla: string | null
  fallback_habilidade: number | null
  planned_order: number
  expected_level: ExpectedLevel
  source: 'auto' | 'manual'
  notes: string | null
  created_at: string
  topic?: ContentTopicRow | null
}

export type MentorAnalysisRunRow = {
  id: string
  mentor_plan_id: string
  school_id: string
  student_key: string
  overall_status: MentorAttentionStatus
  briefing: string
  avg_mastery_planned: number
  avg_mastery_critical: number
  unmapped_questions_count: number
  analyzed_at: string
}

export type MentorAlertRow = {
  id: string
  analysis_run_id: string
  school_id: string
  student_key: string
  topic_id: string | null
  alert_type: MentorAlertType
  severity: MentorAlertSeverity
  message: string
  evidence: Record<string, unknown>
  status: 'active' | 'acknowledged' | 'dismissed' | 'resolved'
  created_at: string
  updated_at: string
  topic?: ContentTopicRow | null
}

export type MentorAlertFeedbackRow = {
  id: string
  mentor_alert_id: string
  mentor_user_id: string
  decision: MentorAlertFeedbackDecision
  note: string | null
  created_at: string
}

export interface ContentTopic {
  readonly id: string
  readonly areaSigla: string
  readonly subjectLabel: string
  readonly topicLabel: string
  readonly canonicalLabel: string
  readonly isActive: boolean
  readonly originSourceContext: TaxonomySourceContext
  readonly originSourceReference: string | null
  readonly createdAt: string
}

export interface ExamQuestionTopic {
  readonly id: string
  readonly examId: string
  readonly questionNumber: number
  readonly topicId: string | null
  readonly mappingSource: ContentMappingSource
  readonly confidence: number | null
  readonly reviewStatus: ReviewStatus
  readonly reviewedBy: string | null
  readonly reviewedAt: string | null
  readonly isActive: boolean
  readonly sourceContext: TaxonomySourceContext
  readonly sourceReference: string | null
  readonly createdAt: string
  readonly topic: ContentTopic | null
}

export interface MentorPlanItem {
  readonly id: string
  readonly mentorPlanId: string
  readonly topicId: string | null
  readonly fallbackLabel: string | null
  readonly fallbackAreaSigla: string | null
  readonly fallbackHabilidade: number | null
  readonly plannedOrder: number
  readonly expectedLevel: ExpectedLevel
  readonly source: 'auto' | 'manual'
  readonly notes: string | null
  readonly createdAt: string
  readonly topic: ContentTopic | null
}

export interface MentorPlanSummary {
  readonly id: string
  readonly schoolId: string
  readonly mentorUserId: string
  readonly targetType: 'student' | 'turma'
  readonly studentKey: string | null
  readonly turma: string | null
  readonly weekStart: string
  readonly weekEnd: string
  readonly source: 'auto_button' | 'manual_edit'
  readonly status: MentorPlanStatus
  readonly capabilityState: MentorCapabilityState
  readonly generationMode: PlanGenerationMode
  readonly taxonomySourceKind: TaxonomySourceKind
  readonly coverageScore: TaxonomyCoverageScore
  readonly isPreviewOnly: boolean
  readonly pdfHistoryId: string | null
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly items: ReadonlyArray<MentorPlanItem>
}

export interface TaxonomyCoverageScore {
  readonly state: MentorCapabilityState
  readonly mappedPairs: number
  readonly totalPairs: number
  readonly coveragePercent: number
  readonly distinctTopics: number
}

export interface TopicMastery {
  readonly topicId: string
  readonly canonicalLabel: string
  readonly areaSigla: string
  readonly masteryScore: number
  readonly weightedAccuracy: number
  readonly recurrencePenalty: number
  readonly sampleSize: number
  readonly confidence: 'low' | 'medium' | 'high'
  readonly lastSeenAt: string | null
  readonly recentAccuracy: number
  readonly consecutiveAssessmentsWithError: number
  readonly planned: boolean
}

export interface MentorAlert {
  readonly id: string
  readonly analysisRunId: string
  readonly schoolId: string
  readonly studentKey: string
  readonly topicId: string | null
  readonly topicLabel: string | null
  readonly alertType: MentorAlertType
  readonly severity: MentorAlertSeverity
  readonly message: string
  readonly evidence: Record<string, unknown>
  readonly status: 'active' | 'acknowledged' | 'dismissed' | 'resolved'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface MentorBriefing {
  readonly summary: string
  readonly action: 'Reforçar base' | 'Manter trilha' | 'Avançar conteúdo'
  readonly highlights: ReadonlyArray<string>
}

export interface CoverageMetrics {
  readonly mappedQuestionsCount: number
  readonly unmappedQuestionsCount: number
  readonly plannedTopicsCount: number
  readonly criticalTopicsCount: number
}

export interface MentorEnvironmentStatus {
  readonly state: MentorCapabilityState
  readonly coreAvailable: boolean
  readonly taxonomyAvailable: boolean
  readonly message: string
}

export interface StudentPerformanceAudit {
  readonly mentorPlanId: string
  readonly schoolId: string
  readonly studentKey: string
  readonly overallStatus: MentorAttentionStatus
  readonly briefing: MentorBriefing
  readonly plannedTopics: ReadonlyArray<TopicMastery>
  readonly criticalTopics: ReadonlyArray<TopicMastery>
  readonly masteryByTopic: ReadonlyArray<TopicMastery>
  readonly alerts: ReadonlyArray<MentorAlert>
  readonly coverageMetrics: CoverageMetrics
  readonly analyzedAt: string
}

export type MentorPlanCreationInput = {
  schoolId: string
  mentorUserId: string
  studentKey: string
  weekStart: string
  weekEnd: string
  capabilityState?: MentorCapabilityState
  generationMode?: PlanGenerationMode
  taxonomySourceKind?: TaxonomySourceKind
  mappedPairs?: number
  totalPairs?: number
  coveragePercent?: number
  distinctTopics?: number
  notes?: string | null
  items: Array<{
    topicId?: string | null
    fallbackLabel?: string | null
    fallbackAreaSigla?: string | null
    fallbackHabilidade?: number | null
    expectedLevel: ExpectedLevel
    source?: 'auto' | 'manual'
    notes?: string | null
  }>
}

export type QuestionBankAuditRunRow = {
  id: string
  created_by: string | null
  source_project_ref: string
  sample_size: number
  findings_count: number
  created_at: string
}

export type QuestionBankAuditFindingRow = {
  id: string
  audit_run_id: string
  source_year: number
  source_question: number
  source_exam: string | null
  question_id: string | null
  defect_type: string
  severity: 'info' | 'warning' | 'critical'
  evidence: Record<string, unknown>
  detected_at: string
}

export type TopicEdgeRow = {
  id: string
  source_topic_id: string
  target_topic_id: string
  edge_type: 'prerequisite' | 'related' | 'depends_on' | 'part_of'
  weight: number
  confidence_score: number | null
  source_context: TaxonomySourceContext
  source_run_id: string | null
  is_active: boolean
  created_at: string
}

export type QuestionEnrichmentRunRow = {
  id: string
  source_system: 'exams' | 'projetos' | 'manual'
  source_reference: string | null
  model_name: string
  status: 'running' | 'completed' | 'failed'
  items_processed: number
  items_written: number
  items_flagged: number
  error_summary: string | null
  created_by: string | null
  created_at: string
  finished_at: string | null
}

export type QuestionEnrichmentRow = {
  id: string
  exam_id: string
  question_number: number
  topic_id: string | null
  enrichment_type: 'topic' | 'entity' | 'skill_hint' | 'difficulty_hint'
  canonical_label: string | null
  confidence_score: number | null
  source_model: string
  source_context: TaxonomySourceContext
  source_run_id: string | null
  status: 'active' | 'flagged' | 'overridden' | 'archived'
  metadata: Record<string, unknown>
  created_at: string
  topic?: ContentTopicRow | null
}

export type QuestionEnrichmentAuditRow = {
  id: string
  question_enrichment_id: string | null
  run_id: string | null
  audit_type:
    | 'low_confidence'
    | 'text_image_mismatch'
    | 'duplicate_conflict'
    | 'missing_visual_context'
    | 'topic_too_generic'
  severity: 'info' | 'warning' | 'critical'
  evidence: Record<string, unknown>
  status: 'open' | 'resolved' | 'ignored'
  created_at: string
}

export interface TopicEdge {
  readonly id: string
  readonly sourceTopicId: string
  readonly targetTopicId: string
  readonly edgeType: 'prerequisite' | 'related' | 'depends_on' | 'part_of'
  readonly weight: number
  readonly confidenceScore: number | null
  readonly sourceContext: TaxonomySourceContext
  readonly sourceRunId: string | null
  readonly isActive: boolean
  readonly createdAt: string
}

export interface QuestionEnrichmentRun {
  readonly id: string
  readonly sourceSystem: 'exams' | 'projetos' | 'manual'
  readonly sourceReference: string | null
  readonly modelName: string
  readonly status: 'running' | 'completed' | 'failed'
  readonly itemsProcessed: number
  readonly itemsWritten: number
  readonly itemsFlagged: number
  readonly errorSummary: string | null
  readonly createdBy: string | null
  readonly createdAt: string
  readonly finishedAt: string | null
}

export interface QuestionEnrichment {
  readonly id: string
  readonly examId: string
  readonly questionNumber: number
  readonly topicId: string | null
  readonly enrichmentType: 'topic' | 'entity' | 'skill_hint' | 'difficulty_hint'
  readonly canonicalLabel: string | null
  readonly confidenceScore: number | null
  readonly sourceModel: string
  readonly sourceContext: TaxonomySourceContext
  readonly sourceRunId: string | null
  readonly status: 'active' | 'flagged' | 'overridden' | 'archived'
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
  readonly topic: ContentTopic | null
}

export interface QuestionEnrichmentAudit {
  readonly id: string
  readonly questionEnrichmentId: string | null
  readonly runId: string | null
  readonly auditType:
    | 'low_confidence'
    | 'text_image_mismatch'
    | 'duplicate_conflict'
    | 'missing_visual_context'
    | 'topic_too_generic'
  readonly severity: 'info' | 'warning' | 'critical'
  readonly evidence: Record<string, unknown>
  readonly status: 'open' | 'resolved' | 'ignored'
  readonly createdAt: string
}

export interface GlinerOpsOverview {
  readonly environment: MentorEnvironmentStatus
  readonly semanticCoreAvailable: boolean
  readonly topicsCount: number
  readonly activeEdgesCount: number
  readonly approvedMappingsCount: number
  readonly pendingMappingsCount: number
  readonly homologationMappingsCount: number
  readonly productionMappingsCount: number
  readonly enrichmentsCount: number
  readonly activeEnrichmentsCount: number
  readonly openAuditsCount: number
  readonly criticalAuditsCount: number
  readonly mentorPlanModeCounts: Readonly<{
    previewOnly: number
    fallbackGuided: number
    hybrid: number
    taxonomyComplete: number
  }>
  readonly taxonomySourceCounts: Readonly<{
    none: number
    homologation: number
    mixed: number
    production: number
  }>
}

export function contentTopicFromRow(row: ContentTopicRow): ContentTopic {
  return {
    id: row.id,
    areaSigla: row.area_sigla,
    subjectLabel: row.subject_label,
    topicLabel: row.topic_label,
    canonicalLabel: row.canonical_label,
    isActive: row.is_active,
    originSourceContext: row.origin_source_context,
    originSourceReference: row.origin_source_reference,
    createdAt: row.created_at,
  }
}

export function examQuestionTopicFromRow(
  row: ExamQuestionTopicRow,
): ExamQuestionTopic {
  return {
    id: row.id,
    examId: row.exam_id,
    questionNumber: row.question_number,
    topicId: row.topic_id,
    mappingSource: row.mapping_source,
    confidence: row.confidence,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    isActive: row.is_active,
    sourceContext: row.source_context,
    sourceReference: row.source_reference,
    createdAt: row.created_at,
    topic: row.topic ? contentTopicFromRow(row.topic) : null,
  }
}

export function mentorPlanItemFromRow(row: MentorPlanItemRow): MentorPlanItem {
  return {
    id: row.id,
    mentorPlanId: row.mentor_plan_id,
    topicId: row.topic_id,
    fallbackLabel: row.fallback_label,
    fallbackAreaSigla: row.fallback_area_sigla,
    fallbackHabilidade: row.fallback_habilidade,
    plannedOrder: row.planned_order,
    expectedLevel: row.expected_level,
    source: row.source,
    notes: row.notes,
    createdAt: row.created_at,
    topic: row.topic ? contentTopicFromRow(row.topic) : null,
  }
}

export function topicEdgeFromRow(row: TopicEdgeRow): TopicEdge {
  return {
    id: row.id,
    sourceTopicId: row.source_topic_id,
    targetTopicId: row.target_topic_id,
    edgeType: row.edge_type,
    weight: row.weight,
    confidenceScore: row.confidence_score,
    sourceContext: row.source_context,
    sourceRunId: row.source_run_id,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function questionEnrichmentRunFromRow(
  row: QuestionEnrichmentRunRow,
): QuestionEnrichmentRun {
  return {
    id: row.id,
    sourceSystem: row.source_system,
    sourceReference: row.source_reference,
    modelName: row.model_name,
    status: row.status,
    itemsProcessed: row.items_processed,
    itemsWritten: row.items_written,
    itemsFlagged: row.items_flagged,
    errorSummary: row.error_summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}

export function questionEnrichmentFromRow(
  row: QuestionEnrichmentRow,
): QuestionEnrichment {
  return {
    id: row.id,
    examId: row.exam_id,
    questionNumber: row.question_number,
    topicId: row.topic_id,
    enrichmentType: row.enrichment_type,
    canonicalLabel: row.canonical_label,
    confidenceScore: row.confidence_score,
    sourceModel: row.source_model,
    sourceContext: row.source_context,
    sourceRunId: row.source_run_id,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.created_at,
    topic: row.topic ? contentTopicFromRow(row.topic) : null,
  }
}

export function questionEnrichmentAuditFromRow(
  row: QuestionEnrichmentAuditRow,
): QuestionEnrichmentAudit {
  return {
    id: row.id,
    questionEnrichmentId: row.question_enrichment_id,
    runId: row.run_id,
    auditType: row.audit_type,
    severity: row.severity,
    evidence: row.evidence,
    status: row.status,
    createdAt: row.created_at,
  }
}
