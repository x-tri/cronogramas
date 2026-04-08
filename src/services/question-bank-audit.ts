import { supabase } from '../lib/supabase'
import {
  QUESTION_BANK_PROJECT_REF,
  getQuestionBankSupabaseClient,
} from '../lib/question-bank-supabase'
import {
  hasUsableOptions,
  isTrustedQuestionImageUrl,
  questionRequiresVisualContext,
  resolveItem,
  sortQuestionOptions,
  type ItemValidationFailure,
  type QuestionCandidateRow,
  type QuestionOptionRow,
} from './question-delivery'

export type QuestionBankAuditFinding = {
  readonly sourceYear: number
  readonly sourceQuestion: number
  readonly sourceExam: string | null
  readonly questionId: string | null
  readonly defectType: string
  readonly severity: 'info' | 'warning' | 'critical'
  readonly evidence: Record<string, unknown>
}

export type QuestionBankAuditRun = {
  readonly sourceProjectRef: string
  readonly sampleSize: number
  readonly findings: ReadonlyArray<QuestionBankAuditFinding>
}

export const KNOWN_QUESTION_BANK_FAILURE_CASES = [
  { sourceYear: 2019, sourceQuestion: 53 },
  { sourceYear: 2020, sourceQuestion: 119 },
  { sourceYear: 2023, sourceQuestion: 102 },
  { sourceYear: 2021, sourceQuestion: 156 },
  { sourceYear: 2022, sourceQuestion: 141 },
  { sourceYear: 2022, sourceQuestion: 175 },
] as const

function uniqueByKey<T>(items: ReadonlyArray<T>, getKey: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = getKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

function toSeverity(defectType: string): 'info' | 'warning' | 'critical' {
  if (
    defectType === 'broken_image_host' ||
    defectType === 'missing_visual_context' ||
    defectType === 'text_image_mismatch'
  ) {
    return 'critical'
  }

  if (defectType === 'duplicate_conflict' || defectType === 'enem_vs_ppl_conflict') {
    return 'warning'
  }

  return 'warning'
}

async function fetchCandidatesForAudit(params: {
  sourceYear: number
  sourceQuestion: number
}): Promise<{
  candidates: QuestionCandidateRow[]
  optionsByQuestionId: Map<string, QuestionOptionRow[]>
}> {
  const client = getQuestionBankSupabaseClient()
  const { data: candidatesData } = await client
    .from('questions')
    .select('id, stem, source_year, source_question, source_exam, difficulty, support_text, image_url, image_alt, created_at')
    .eq('source', 'ENEM')
    .eq('source_year', params.sourceYear)
    .eq('source_question', params.sourceQuestion)

  const candidates = (candidatesData ?? []) as QuestionCandidateRow[]
  const questionIds = candidates.map((candidate) => candidate.id)
  const optionsByQuestionId = new Map<string, QuestionOptionRow[]>()

  if (questionIds.length > 0) {
    const { data: optionsData } = await client
      .from('question_options')
      .select('question_id, letter, text, is_correct')
      .in('question_id', questionIds)

    for (const option of ((optionsData ?? []) as Array<{
      question_id: string
      letter: string
      text: string
      is_correct: boolean
    }>)) {
      const existing = optionsByQuestionId.get(option.question_id)
      const normalized: QuestionOptionRow = {
        letter: option.letter,
        text: option.text,
        is_correct: option.is_correct,
      }
      if (existing) {
        existing.push(normalized)
      } else {
        optionsByQuestionId.set(option.question_id, [normalized])
      }
    }
  }

  for (const [questionId, options] of optionsByQuestionId.entries()) {
    optionsByQuestionId.set(questionId, sortQuestionOptions(options))
  }

  return {
    candidates,
    optionsByQuestionId,
  }
}

function auditCandidate(params: {
  sourceYear: number
  sourceQuestion: number
  candidate: QuestionCandidateRow
  options: ReadonlyArray<QuestionOptionRow>
}): QuestionBankAuditFinding[] {
  const findings: QuestionBankAuditFinding[] = []
  const requiresVisualContext = questionRequiresVisualContext(params.candidate)

  if (params.candidate.image_url && !isTrustedQuestionImageUrl(params.candidate.image_url)) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: params.candidate.source_exam ?? null,
      questionId: params.candidate.id,
      defectType: 'broken_image_host',
      severity: 'critical',
      evidence: {
        image_url: params.candidate.image_url,
      },
    })
  }

  if (requiresVisualContext && !isTrustedQuestionImageUrl(params.candidate.image_url)) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: params.candidate.source_exam ?? null,
      questionId: params.candidate.id,
      defectType: 'missing_visual_context',
      severity: 'critical',
      evidence: {
        stem: params.candidate.stem,
        support_text: params.candidate.support_text,
        image_url: params.candidate.image_url,
      },
    })
  }

  if (!requiresVisualContext && isTrustedQuestionImageUrl(params.candidate.image_url)) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: params.candidate.source_exam ?? null,
      questionId: params.candidate.id,
      defectType: 'text_image_mismatch',
      severity: 'critical',
      evidence: {
        stem: params.candidate.stem,
        support_text: params.candidate.support_text,
        image_url: params.candidate.image_url,
      },
    })
  }

  if (!hasUsableOptions(params.options)) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: params.candidate.source_exam ?? null,
      questionId: params.candidate.id,
      defectType: 'invalid_options',
      severity: 'warning',
      evidence: {
        options: params.options,
      },
    })
  }

  return findings
}

function buildResolutionFinding(params: {
  sourceYear: number
  sourceQuestion: number
  failureReason: ItemValidationFailure
}): QuestionBankAuditFinding {
  return {
    sourceYear: params.sourceYear,
    sourceQuestion: params.sourceQuestion,
    sourceExam: null,
    questionId: null,
    defectType: params.failureReason,
    severity: toSeverity(params.failureReason),
    evidence: {
      reason: params.failureReason,
    },
  }
}

export async function collectAuditFindingsForCandidates(params: {
  sourceYear: number
  sourceQuestion: number
  candidates: ReadonlyArray<QuestionCandidateRow>
  optionsByQuestionId: ReadonlyMap<string, ReadonlyArray<QuestionOptionRow>>
}): Promise<QuestionBankAuditFinding[]> {
  if (params.candidates.length === 0) {
    return [{
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: null,
      questionId: null,
      defectType: 'item_not_found',
      severity: 'warning',
      evidence: {},
    }]
  }

  const findings: QuestionBankAuditFinding[] = []
  const distinctExams = [...new Set(params.candidates.map((candidate) => candidate.source_exam ?? ''))]

  if (distinctExams.length > 1) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: null,
      questionId: null,
      defectType: 'duplicate_conflict',
      severity: 'warning',
      evidence: {
        source_exams: distinctExams,
        candidate_ids: params.candidates.map((candidate) => candidate.id),
      },
    })
  }

  if (
    distinctExams.some((exam) => exam.toUpperCase().includes('ENEM')) &&
    distinctExams.some((exam) => exam.toUpperCase().includes('PPL'))
  ) {
    findings.push({
      sourceYear: params.sourceYear,
      sourceQuestion: params.sourceQuestion,
      sourceExam: null,
      questionId: null,
      defectType: 'enem_vs_ppl_conflict',
      severity: 'warning',
      evidence: {
        source_exams: distinctExams,
      },
    })
  }

  for (const candidate of params.candidates) {
    findings.push(
      ...auditCandidate({
        sourceYear: params.sourceYear,
        sourceQuestion: params.sourceQuestion,
        candidate,
        options: params.optionsByQuestionId.get(candidate.id) ?? [],
      }),
    )
  }

  const resolution = await resolveItem(
    params.sourceYear,
    params.sourceQuestion,
    'LC',
    'audit',
    {
      candidateRows: params.candidates,
      optionsByQuestionId: params.optionsByQuestionId,
    },
  )

  if (resolution.status !== 'resolved' && resolution.failureReason) {
    findings.push(
      buildResolutionFinding({
        sourceYear: params.sourceYear,
        sourceQuestion: params.sourceQuestion,
        failureReason: resolution.failureReason,
      }),
    )
  }

  return uniqueByKey(findings, (finding) =>
    [
      finding.sourceYear,
      finding.sourceQuestion,
      finding.sourceExam ?? 'global',
      finding.questionId ?? 'none',
      finding.defectType,
    ].join(':'),
  )
}

export async function auditQuestionBankItem(params: {
  sourceYear: number
  sourceQuestion: number
}): Promise<QuestionBankAuditFinding[]> {
  const { candidates, optionsByQuestionId } = await fetchCandidatesForAudit(params)
  return collectAuditFindingsForCandidates({
    sourceYear: params.sourceYear,
    sourceQuestion: params.sourceQuestion,
    candidates,
    optionsByQuestionId,
  })
}

export async function runQuestionBankAudit(params?: {
  readonly cases?: ReadonlyArray<{ sourceYear: number; sourceQuestion: number }>
  readonly persist?: boolean
}): Promise<QuestionBankAuditRun> {
  const cases = params?.cases ?? KNOWN_QUESTION_BANK_FAILURE_CASES
  const findingsNested = await Promise.all(
    cases.map((item) =>
      auditQuestionBankItem({
        sourceYear: item.sourceYear,
        sourceQuestion: item.sourceQuestion,
      }),
    ),
  )

  const findings = findingsNested.flat()
  const run: QuestionBankAuditRun = {
    sourceProjectRef: QUESTION_BANK_PROJECT_REF,
    sampleSize: cases.length,
    findings,
  }

  if (params?.persist !== false) {
    await persistQuestionBankAuditRun(run)
  }

  return run
}

export async function persistQuestionBankAuditRun(
  run: QuestionBankAuditRun,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: insertedRun, error: runError } = await supabase
    .from('question_bank_audit_runs')
    .insert({
      created_by: user?.id ?? null,
      source_project_ref: run.sourceProjectRef,
      sample_size: run.sampleSize,
      findings_count: run.findings.length,
    })
    .select('id')
    .single()

  if (runError || !insertedRun) {
    throw new Error(`Falha ao persistir execução da auditoria: ${runError?.message}`)
  }

  if (run.findings.length === 0) {
    return
  }

  const { error: findingsError } = await supabase
    .from('question_bank_audit_findings')
    .insert(
      run.findings.map((finding) => ({
        audit_run_id: insertedRun.id,
        source_year: finding.sourceYear,
        source_question: finding.sourceQuestion,
        source_exam: finding.sourceExam,
        question_id: finding.questionId,
        defect_type: finding.defectType,
        severity: finding.severity,
        evidence: finding.evidence,
      })),
    )

  if (findingsError) {
    throw new Error(`Falha ao persistir achados da auditoria: ${findingsError.message}`)
  }
}
