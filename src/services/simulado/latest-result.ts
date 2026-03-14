import { supabase } from '../../lib/supabase'
import type {
  Exam,
  QuestionContent,
  SimuladoResult,
  StudentAnswer,
  WrongQuestion,
} from '../../types/supabase'
import { findWrongQuestionsForDay, groupByTopic } from './helpers'

export async function getLatestSimuladoResult(
  sheetCode: string,
): Promise<SimuladoResult | null> {
  // Normalizar o sheetCode para busca (remover zeros à esquerda para comparação flexível)
  const normalizedSheetCode = sheetCode.trim().replace(/^0+/, '') || '0'
  console.log(
    '[getLatestSimuladoResult] Buscando student_answers para:',
    sheetCode,
    '(normalizado:',
    normalizedSheetCode + ')',
  )

  // 1. Buscar TODAS as respostas recentes do aluno
  // Primeiro tentar buscar exatamente como foi passado
  let { data: answersData, error: answersError } = await supabase
    .from('student_answers')
    .select('*')
    .eq('student_number', sheetCode)
    .order('created_at', { ascending: false })
    .limit(10)

  // Se não encontrou, tentar com zeros à esquerda removidos
  if (
    (!answersData || answersData.length === 0) &&
    normalizedSheetCode !== sheetCode.trim()
  ) {
    console.log(
      '[getLatestSimuladoResult] Não encontrado com formato original, tentando sem zeros à esquerda:',
      normalizedSheetCode,
    )
    const { data: normalizedData, error: normalizedError } = await supabase
      .from('student_answers')
      .select('*')
      .eq('student_number', normalizedSheetCode)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!normalizedError && normalizedData && normalizedData.length > 0) {
      answersData = normalizedData
      answersError = null
    }
  }

  if (answersError) {
    console.error(
      '[getLatestSimuladoResult] Error fetching student answers:',
      answersError,
    )
    return null
  }

  if (!answersData || answersData.length === 0) {
    console.log(
      '[getLatestSimuladoResult] Nenhuma resposta encontrada para:',
      sheetCode,
    )
    return null
  }

  console.log(
    '[getLatestSimuladoResult] Encontradas',
    answersData.length,
    'respostas',
  )

  // 2. Buscar exames correspondentes
  const examIds = [...new Set(answersData.map((a) => a.exam_id))]
  const { data: examsData, error: examsError } = await supabase
    .from('exams')
    .select('id, title, question_contents')
    .in('id', examIds)

  if (examsError || !examsData) {
    console.error('Error fetching exams:', examsError)
    return null
  }

  // 3. Separar exames por dia (1-90 vs 91-180)
  const examsMap = new Map(examsData.map((e) => [e.id, e]))

  let day1Answer: StudentAnswer | null = null
  let day2Answer: StudentAnswer | null = null
  let day1Exam: Exam | null = null
  let day2Exam: Exam | null = null

  for (const answer of answersData) {
    const exam = examsMap.get(answer.exam_id)
    if (!exam?.question_contents?.length) continue

    const firstQ = (exam.question_contents as QuestionContent[])[0].questionNumber

    if (firstQ === 1 && !day1Answer) {
      day1Answer = answer as StudentAnswer
      day1Exam = exam as Exam
    } else if (firstQ === 91 && !day2Answer) {
      day2Answer = answer as StudentAnswer
      day2Exam = exam as Exam
    }

    if (day1Answer && day2Answer) break
  }

  // 4. Usar o mais recente como "principal" para scores/metadata
  const primaryAnswer = day2Answer || day1Answer
  const primaryExam = day2Exam || day1Exam

  if (!primaryAnswer || !primaryExam) return null

  // 5. Encontrar erros de AMBOS os dias separadamente
  const wrongQuestions: WrongQuestion[] = []

  // Erros do dia 1 (questões 1-90)
  if (day1Exam?.question_contents && day1Answer) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(day1Answer.answers, day1Exam.question_contents),
    )
  }

  // Erros do dia 2 (questões 91-180)
  if (day2Exam?.question_contents && day2Answer) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(day2Answer.answers, day2Exam.question_contents),
    )
  }

  // 6. Agrupar por tópico
  const topicsSummary = groupByTopic(wrongQuestions)

  return {
    exam: {
      ...primaryExam,
      title:
        [day1Exam?.title, day2Exam?.title].filter(Boolean).join(' + ') ||
        primaryExam.title,
    },
    studentAnswer: primaryAnswer,
    wrongQuestions,
    topicsSummary,
  }
}
