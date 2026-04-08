import { createClient } from '@supabase/supabase-js'

const QUESTION_BANK_URL = 'https://uhqdkaftqjxenobdfqkd.supabase.co'
const QUESTION_BANK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocWRrYWZ0cWp4ZW5vYmRmcWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Njg0NzYsImV4cCI6MjA4MjU0NDQ3Nn0.Ou2h8u9lbRUAAkJtdTtBknKfchqcYXlxWIyGizk5bns'

function parseYearArg() {
  const raw = process.argv[2]
  const parsed = Number(raw ?? '2020')

  if (!Number.isInteger(parsed) || parsed < 1998) {
    throw new Error('Ano inválido. Use: node scripts/audit_question_bank_duplicates.mjs 2020')
  }

  return parsed
}

function buildOptionSignature(options) {
  return [...options]
    .sort((left, right) => left.letter.localeCompare(right.letter))
    .map((option) => `${option.letter}:${option.text.trim()}`)
    .join('|')
}

async function main() {
  const year = parseYearArg()
  const supabase = createClient(QUESTION_BANK_URL, QUESTION_BANK_ANON_KEY)

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, source_year, source_question, stem, image_url')
    .eq('source', 'ENEM')
    .eq('source_year', year)

  if (questionsError) {
    throw questionsError
  }

  const questionIds = (questions ?? []).map((question) => String(question.id))
  const { data: options, error: optionsError } = await supabase
    .from('question_options')
    .select('question_id, letter, text')
    .in('question_id', questionIds)

  if (optionsError) {
    throw optionsError
  }

  const optionsByQuestionId = new Map()
  for (const option of options ?? []) {
    const questionId = String(option.question_id)
    const existing = optionsByQuestionId.get(questionId)
    const normalized = {
      letter: String(option.letter),
      text: String(option.text ?? ''),
    }

    if (existing) {
      existing.push(normalized)
    } else {
      optionsByQuestionId.set(questionId, [normalized])
    }
  }

  const duplicateGroups = new Map()

  for (const question of questions ?? []) {
    const questionId = String(question.id)
    const questionOptions = optionsByQuestionId.get(questionId) ?? []
    if (questionOptions.length === 0) continue

    const signature = buildOptionSignature(questionOptions)
    const existing = duplicateGroups.get(signature)
    const normalizedQuestion = {
      id: questionId,
      sourceQuestion: Number(question.source_question),
      stem: String(question.stem ?? '').slice(0, 140),
      imageUrl: question.image_url ? String(question.image_url) : null,
    }

    if (existing) {
      existing.push(normalizedQuestion)
    } else {
      duplicateGroups.set(signature, [normalizedQuestion])
    }
  }

  const suspiciousGroups = [...duplicateGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([signature, rows]) => ({
      signature,
      rows: rows.sort((left, right) => left.sourceQuestion - right.sourceQuestion),
    }))
    .sort((left, right) => left.rows[0].sourceQuestion - right.rows[0].sourceQuestion)

  console.log(JSON.stringify({
    year,
    duplicateGroupCount: suspiciousGroups.length,
    suspiciousGroups,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
