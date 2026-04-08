import { createClient } from '@supabase/supabase-js'

const QUESTION_BANK_URL = 'https://uhqdkaftqjxenobdfqkd.supabase.co'
const QUESTION_BANK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocWRrYWZ0cWp4ZW5vYmRmcWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Njg0NzYsImV4cCI6MjA4MjU0NDQ3Nn0.Ou2h8u9lbRUAAkJtdTtBknKfchqcYXlxWIyGizk5bns'

const APP_SUPABASE_URL = process.env.APP_SUPABASE_URL
const APP_SUPABASE_SERVICE_ROLE_KEY = process.env.APP_SUPABASE_SERVICE_ROLE_KEY

const KNOWN_CASES = [
  { sourceYear: 2019, sourceQuestion: 53 },
  { sourceYear: 2020, sourceQuestion: 119 },
  { sourceYear: 2023, sourceQuestion: 102 },
  { sourceYear: 2021, sourceQuestion: 156 },
  { sourceYear: 2022, sourceQuestion: 141 },
  { sourceYear: 2022, sourceQuestion: 175 },
]

const bank = createClient(QUESTION_BANK_URL, QUESTION_BANK_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

function normalizeText(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isTrustedQuestionImageUrl(imageUrl) {
  if (!imageUrl) return false
  try {
    const url = new URL(imageUrl)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname === 'uhqdkaftqjxenobdfqkd.supabase.co' &&
      url.pathname.includes('/storage/v1/object/public/enem-images/')
    )
  } catch {
    return false
  }
}

function questionRequiresVisualContext(candidate) {
  const text = normalizeText(
    [candidate.support_text, candidate.stem, candidate.image_alt].filter(Boolean).join(' '),
  )
  return [
    'figura',
    'grafico',
    'gráfico',
    'tabela',
    'imagem',
    'matriz',
    'mapa',
    'diagrama',
    'observe a figura',
    'observe o gráfico',
    'observe a tabela',
  ].some((keyword) => text.includes(normalizeText(keyword)))
}

function hasUsableOptions(options) {
  if (options.length !== 5) return false
  const letters = options
    .map((option) => option.letter.toUpperCase())
    .sort()
    .join(',')
  if (letters !== 'A,B,C,D,E') return false
  return options.every((option) => !/^[A-E]$/.test(option.text.trim().toUpperCase()))
}

async function auditCase(item) {
  const { data: candidates = [] } = await bank
    .from('questions')
    .select('id, stem, source_year, source_question, source_exam, support_text, image_url, image_alt')
    .eq('source', 'ENEM')
    .eq('source_year', item.sourceYear)
    .eq('source_question', item.sourceQuestion)

  const questionIds = candidates.map((candidate) => candidate.id)
  const { data: options = [] } =
    questionIds.length > 0
      ? await bank
          .from('question_options')
          .select('question_id, letter, text, is_correct')
          .in('question_id', questionIds)
      : { data: [] }

  const findings = []
  const distinctExams = [...new Set(candidates.map((candidate) => candidate.source_exam ?? ''))]

  if (distinctExams.length > 1) {
    findings.push({
      source_year: item.sourceYear,
      source_question: item.sourceQuestion,
      source_exam: null,
      question_id: null,
      defect_type: 'duplicate_conflict',
      severity: 'warning',
      evidence: { source_exams: distinctExams },
    })
  }

  if (
    distinctExams.some((exam) => exam.toUpperCase().includes('ENEM')) &&
    distinctExams.some((exam) => exam.toUpperCase().includes('PPL'))
  ) {
    findings.push({
      source_year: item.sourceYear,
      source_question: item.sourceQuestion,
      source_exam: null,
      question_id: null,
      defect_type: 'enem_vs_ppl_conflict',
      severity: 'warning',
      evidence: { source_exams: distinctExams },
    })
  }

  for (const candidate of candidates) {
    const candidateOptions = options.filter((option) => option.question_id === candidate.id)
    if (candidate.image_url && !isTrustedQuestionImageUrl(candidate.image_url)) {
      findings.push({
        source_year: item.sourceYear,
        source_question: item.sourceQuestion,
        source_exam: candidate.source_exam ?? null,
        question_id: candidate.id,
        defect_type: 'broken_image_host',
        severity: 'critical',
        evidence: { image_url: candidate.image_url },
      })
    }

    if (questionRequiresVisualContext(candidate) && !isTrustedQuestionImageUrl(candidate.image_url)) {
      findings.push({
        source_year: item.sourceYear,
        source_question: item.sourceQuestion,
        source_exam: candidate.source_exam ?? null,
        question_id: candidate.id,
        defect_type: 'missing_visual_context',
        severity: 'critical',
        evidence: { image_url: candidate.image_url },
      })
    }

    if (!questionRequiresVisualContext(candidate) && isTrustedQuestionImageUrl(candidate.image_url)) {
      findings.push({
        source_year: item.sourceYear,
        source_question: item.sourceQuestion,
        source_exam: candidate.source_exam ?? null,
        question_id: candidate.id,
        defect_type: 'text_image_mismatch',
        severity: 'critical',
        evidence: { image_url: candidate.image_url },
      })
    }

    if (!hasUsableOptions(candidateOptions)) {
      findings.push({
        source_year: item.sourceYear,
        source_question: item.sourceQuestion,
        source_exam: candidate.source_exam ?? null,
        question_id: candidate.id,
        defect_type: 'invalid_options',
        severity: 'warning',
        evidence: { options: candidateOptions },
      })
    }
  }

  return findings
}

async function persist(findings) {
  if (!APP_SUPABASE_URL || !APP_SUPABASE_SERVICE_ROLE_KEY) {
    return false
  }

  const app = createClient(APP_SUPABASE_URL, APP_SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data: run, error: runError } = await app
    .from('question_bank_audit_runs')
    .insert({
      created_by: null,
      source_project_ref: 'uhqdkaftqjxenobdfqkd',
      sample_size: KNOWN_CASES.length,
      findings_count: findings.length,
    })
    .select('id')
    .single()

  if (runError || !run) {
    throw new Error(`Falha ao persistir audit run: ${runError?.message}`)
  }

  if (findings.length > 0) {
    const { error } = await app.from('question_bank_audit_findings').insert(
      findings.map((finding) => ({
        audit_run_id: run.id,
        ...finding,
      })),
    )
    if (error) {
      throw new Error(`Falha ao persistir findings: ${error.message}`)
    }
  }

  return true
}

const findings = (await Promise.all(KNOWN_CASES.map(auditCase))).flat()
console.log(JSON.stringify({
  source_project_ref: 'uhqdkaftqjxenobdfqkd',
  sample_size: KNOWN_CASES.length,
  findings_count: findings.length,
  findings,
}, null, 2))

const persisted = await persist(findings)
if (persisted) {
  console.log('Auditoria persistida no backend do app.')
}
