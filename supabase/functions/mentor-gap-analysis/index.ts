import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildStudentPerformanceAudit, type PlanTopicRef, type TopicPerformanceRecord } from '../../../src/services/mentor-gap-engine.ts'
import { buildStudentNumberCandidates, parseStudentKey } from '../../../src/services/student-key.ts'

type QuestionContentLike = {
  questionNumber?: number
  numero?: number
  questao?: number
  answer?: string
  resposta?: string
}

type RawPerformanceRecord = {
  readonly examId: string
  readonly assessedAt: string
  readonly questionNumber: number
  readonly correct: boolean
}

type MentorPlanRow = {
  id: string
  school_id: string
  student_key: string | null
  week_start: string
  items?: Array<{
    id: string
    topic_id: string
    planned_order: number
    topic?: {
      canonical_label: string
      area_sigla: string
    } | null
  }> | null
}

type ProjetoStudent = {
  readonly matricula?: string
  readonly student_number?: string
  readonly studentNumber?: string
  readonly answers?: string[]
}

type RequestPayload = {
  school_id?: string
  student_key?: string
  mentor_plan_id?: string
  window_days?: number
  reference_date?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getEnv(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? (fallback ? Deno.env.get(fallback) : undefined)
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`)
  }
  return value
}

function createPrimaryClient() {
  const url = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_KEY')
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

function createSimuladoClient() {
  const primaryUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? ''
  const primaryKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('VITE_SUPABASE_KEY') ??
    ''

  const url =
    Deno.env.get('SIMULADO_SUPABASE_URL') ??
    Deno.env.get('VITE_SIMULADO_SUPABASE_URL') ??
    primaryUrl
  const key =
    Deno.env.get('SIMULADO_SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SIMULADO_SUPABASE_KEY') ??
    Deno.env.get('VITE_SIMULADO_SUPABASE_KEY') ??
    primaryKey

  if (!url || !key) {
    throw new Error('Configuração do Supabase de simulados ausente.')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

function parseQuestionContents(payload: unknown): QuestionContentLike[] {
  if (!Array.isArray(payload)) return []
  return payload as QuestionContentLike[]
}

function parseQuestionNumber(item: QuestionContentLike, fallbackIndex: number): number {
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

  return fallbackIndex + 1
}

function answerAt(answers: string[], index: number): string {
  return (answers[index] ?? '').trim()
}

function buildQuestionRecordsFromExam(params: {
  examId: string
  assessedAt: string
  answers: string[]
  questionContents: QuestionContentLike[]
  answerKey: string[] | null
}): RawPerformanceRecord[] {
  if (params.questionContents.length === 0) {
    return (params.answerKey ?? []).map((correctAnswer, index) => ({
      examId: params.examId,
      assessedAt: params.assessedAt,
      questionNumber: index + 1,
      correct: answerAt(params.answers, index) === (correctAnswer ?? '').trim(),
    }))
  }

  const normalizedQuestions = params.questionContents.map((item, index) => ({
    questionNumber: parseQuestionNumber(item, index),
    answer: typeof item.answer === 'string'
      ? item.answer.trim()
      : typeof item.resposta === 'string'
        ? item.resposta.trim()
        : '',
  }))
  const firstQuestionNumber = normalizedQuestions[0]?.questionNumber ?? 1

  return normalizedQuestions.map((question) => {
    const answerIndex = Math.max(0, question.questionNumber - firstQuestionNumber)
    const answerKey = params.answerKey?.[answerIndex] ?? question.answer

    return {
      examId: params.examId,
      assessedAt: params.assessedAt,
      questionNumber: question.questionNumber,
      correct: answerAt(params.answers, answerIndex) === answerKey,
    }
  })
}

async function fetchPlan(primary: ReturnType<typeof createPrimaryClient>, planId: string): Promise<MentorPlanRow> {
  const { data, error } = await primary
    .from('mentor_plans')
    .select(`
      id,
      school_id,
      student_key,
      week_start,
      items:mentor_plan_items(
        id,
        topic_id,
        planned_order,
        topic:content_topics(
          canonical_label,
          area_sigla
        )
      )
    `)
    .eq('id', planId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Plano do mentor não encontrado.')
  }

  return data as MentorPlanRow
}

async function fetchStudentAnswersPerformance(
  simulado: ReturnType<typeof createSimuladoClient>,
  studentKey: string,
  startDateIso: string,
): Promise<RawPerformanceRecord[]> {
  const candidates = buildStudentNumberCandidates(studentKey)
  if (candidates.length === 0) return []

  const { data: answers, error } = await simulado
    .from('student_answers')
    .select('exam_id, answers, created_at')
    .in('student_number', candidates)
    .gte('created_at', startDateIso)
    .order('created_at', { ascending: false })

  if (error || !answers || answers.length === 0) {
    return []
  }

  const examIds = [...new Set(answers.map((answer) => answer.exam_id as string))]
  const { data: exams } = await simulado
    .from('exams')
    .select('id, answer_key, question_contents')
    .in('id', examIds)

  const examsById = new Map(
    ((exams ?? []) as Array<{
      id: string
      answer_key: string[] | null
      question_contents: QuestionContentLike[] | null
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

function isMatchingProjetoStudent(student: ProjetoStudent, studentKey: string): boolean {
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
  simulado: ReturnType<typeof createSimuladoClient>,
  studentKey: string,
  startDateIso: string,
): Promise<RawPerformanceRecord[]> {
  const parsed = parseStudentKey(studentKey)
  if (parsed.kind === 'avulso') return []

  const { data: projetos, error } = await simulado
    .from('projetos')
    .select('id, created_at, answer_key, question_contents, students')
    .gte('created_at', startDateIso)
    .order('created_at', { ascending: false })

  if (error || !projetos || projetos.length === 0) {
    return []
  }

  return (projetos as Array<{
    id: string
    created_at: string
    answer_key: string[] | null
    question_contents: QuestionContentLike[] | null
    students?: ProjetoStudent[] | null
  }>).flatMap((projeto) => {
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
}

async function fetchApprovedMappingsForRecords(
  primary: ReturnType<typeof createPrimaryClient>,
  records: ReadonlyArray<RawPerformanceRecord>,
) {
  const examIds = [...new Set(records.map((record) => record.examId))]
  const questionNumbers = [...new Set(records.map((record) => record.questionNumber))]

  if (examIds.length === 0 || questionNumbers.length === 0) {
    return []
  }

  const { data, error } = await primary
    .from('exam_question_topics')
    .select(`
      exam_id,
      question_number,
      topic_id,
      topic:content_topics(
        canonical_label,
        area_sigla
      )
    `)
    .in('exam_id', examIds)
    .in('question_number', questionNumbers)
    .eq('review_status', 'approved')

  if (error) {
    throw new Error(`Falha ao carregar mapeamentos aprovados: ${error.message}`)
  }

  const validPairs = new Set(records.map((record) => `${record.examId}:${record.questionNumber}`))

  return ((data ?? []) as Array<{
    exam_id: string
    question_number: number
    topic_id: string | null
    topic?: {
      canonical_label: string
      area_sigla: string
    } | null
  }>).filter((row) => validPairs.has(`${row.exam_id}:${row.question_number}`))
}

function buildPlanTopicRefs(plan: MentorPlanRow): PlanTopicRef[] {
  return (plan.items ?? [])
    .filter((item) => item.topic_id && item.topic)
    .map((item) => ({
      topicId: item.topic_id,
      canonicalLabel: item.topic?.canonical_label ?? item.topic_id,
      areaSigla: item.topic?.area_sigla ?? 'OUT',
      plannedOrder: item.planned_order,
    }))
}

async function buildAuditInput(
  primary: ReturnType<typeof createPrimaryClient>,
  simulado: ReturnType<typeof createSimuladoClient>,
  plan: MentorPlanRow,
  windowDays: number,
  referenceDate: string | undefined,
) {
  const baseDate = referenceDate ? new Date(referenceDate) : new Date()
  const startDateIso = new Date(
    baseDate.getTime() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  const rawRecordsFromAnswers = await fetchStudentAnswersPerformance(
    simulado,
    plan.student_key ?? '',
    startDateIso,
  )
  const rawRecords =
    rawRecordsFromAnswers.length > 0
      ? rawRecordsFromAnswers
      : await fetchProjetosPerformance(simulado, plan.student_key ?? '', startDateIso)

  const mappings = await fetchApprovedMappingsForRecords(primary, rawRecords)
  const mappingsByPair = new Map(
    mappings.map((mapping) => [
      `${mapping.exam_id}:${mapping.question_number}`,
      mapping,
    ]),
  )

  const records = rawRecords.flatMap<TopicPerformanceRecord>((record) => {
    const mapping = mappingsByPair.get(`${record.examId}:${record.questionNumber}`)
    if (!mapping?.topic_id || !mapping.topic) {
      return []
    }

    return [{
      topicId: mapping.topic_id,
      canonicalLabel: mapping.topic.canonical_label,
      areaSigla: mapping.topic.area_sigla,
      examId: record.examId,
      assessedAt: record.assessedAt,
      questionNumber: record.questionNumber,
      correct: record.correct,
      difficulty: null,
    }]
  })

  const { data: previousPlans } = await primary
    .from('mentor_plans')
    .select(`
      items:mentor_plan_items(
        topic_id
      )
    `)
    .eq('school_id', plan.school_id)
    .eq('student_key', plan.student_key)
    .eq('status', 'sent')
    .neq('id', plan.id)
    .order('week_start', { ascending: false })
    .limit(2)

  return {
    records,
    mappedQuestionsCount: records.length,
    unmappedQuestionsCount: Math.max(0, rawRecords.length - records.length),
    previousPlanTopicIds: ((previousPlans ?? []) as Array<{
      items?: Array<{ topic_id: string }> | null
    }>).map((planRow) => (planRow.items ?? []).map((item) => item.topic_id)),
  }
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

async function persistAudit(
  primary: ReturnType<typeof createPrimaryClient>,
  plan: MentorPlanRow,
  audit: ReturnType<typeof buildStudentPerformanceAudit>,
) {
  await primary
    .from('mentor_alerts')
    .update({
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('school_id', plan.school_id)
    .eq('student_key', plan.student_key ?? '')
    .in('status', ['active', 'acknowledged'])

  const { data: runRow, error: runError } = await primary
    .from('mentor_analysis_runs')
    .insert({
      mentor_plan_id: plan.id,
      school_id: plan.school_id,
      student_key: plan.student_key,
      overall_status: audit.overallStatus,
      briefing: audit.briefing.summary,
      avg_mastery_planned: average(audit.plannedTopics.map((topic) => topic.masteryScore)),
      avg_mastery_critical: average(audit.criticalTopics.map((topic) => topic.masteryScore)),
      unmapped_questions_count: audit.coverageMetrics.unmappedQuestionsCount,
    })
    .select('id, analyzed_at')
    .single()

  if (runError || !runRow) {
    throw new Error(`Falha ao persistir análise do mentor: ${runError?.message}`)
  }

  if (audit.alerts.length > 0) {
    const { error: alertsError } = await primary
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

  const { data: persistedAlerts } = await primary
    .from('mentor_alerts')
    .select(`
      id,
      analysis_run_id,
      school_id,
      student_key,
      topic_id,
      alert_type,
      severity,
      message,
      evidence,
      status,
      created_at,
      updated_at,
      topic:content_topics(
        canonical_label
      )
    `)
    .eq('analysis_run_id', runRow.id)
    .order('created_at', { ascending: true })

  return {
    ...audit,
    analyzedAt: runRow.analyzed_at,
    alerts: ((persistedAlerts ?? []) as Array<{
      id: string
      analysis_run_id: string
      school_id: string
      student_key: string
      topic_id: string | null
      alert_type: 'misaligned_plan' | 'not_absorbed' | 'persistent_gap' | 'can_advance'
      severity: 'info' | 'warning' | 'critical'
      message: string
      evidence: Record<string, unknown>
      status: 'active' | 'acknowledged' | 'dismissed' | 'resolved'
      created_at: string
      updated_at: string
      topic?: { canonical_label: string } | null
    }>).map((alert) => ({
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

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método não permitido.' })
  }

  try {
    const payload = (await request.json()) as RequestPayload
    const mentorPlanId = payload.mentor_plan_id?.trim()

    if (!mentorPlanId) {
      return jsonResponse(400, { error: 'mentor_plan_id é obrigatório.' })
    }

    const primary = createPrimaryClient()
    const simulado = createSimuladoClient()
    const plan = await fetchPlan(primary, mentorPlanId)

    if (!plan.student_key) {
      return jsonResponse(400, { error: 'O V1 exige plano individual com student_key.' })
    }
    if (payload.school_id && payload.school_id !== plan.school_id) {
      return jsonResponse(400, { error: 'school_id divergente do plano informado.' })
    }
    if (payload.student_key && payload.student_key !== plan.student_key) {
      return jsonResponse(400, { error: 'student_key divergente do plano informado.' })
    }

    const windowDays =
      typeof payload.window_days === 'number' && payload.window_days > 0
        ? payload.window_days
        : 90
    const auditInput = await buildAuditInput(
      primary,
      simulado,
      plan,
      windowDays,
      payload.reference_date,
    )

    const audit = buildStudentPerformanceAudit({
      mentorPlanId: plan.id,
      schoolId: plan.school_id,
      studentKey: plan.student_key,
      planTopics: buildPlanTopicRefs(plan),
      previousPlanTopicIds: auditInput.previousPlanTopicIds,
      records: auditInput.records,
      mappedQuestionsCount: auditInput.mappedQuestionsCount,
      unmappedQuestionsCount: auditInput.unmappedQuestionsCount,
    })
    const persisted = await persistAudit(primary, plan, audit)

    return jsonResponse(200, { audit: persisted })
  } catch (error) {
    console.error('[mentor-gap-analysis]', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Falha interna na análise do mentor.',
    })
  }
})
