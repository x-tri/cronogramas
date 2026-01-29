import { supabase } from '../lib/supabase'
import type {
  SupabaseStudent,
  StudentAnswer,
  Exam,
  QuestionContent,
  WrongQuestion,
  SimuladoResult,
  TopicSummary,
} from '../types/supabase'

export async function getStudentByMatricula(
  matricula: string
): Promise<SupabaseStudent | null> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('matricula', matricula)
    .single()

  if (error) {
    console.error('Error fetching student:', error)
    return null
  }

  return data
}

export async function getLatestSimuladoResult(
  sheetCode: string
): Promise<SimuladoResult | null> {
  // 1. Buscar TODAS as respostas recentes do aluno
  const { data: answersData, error: answersError } = await supabase
    .from('student_answers')
    .select('*')
    .eq('student_number', sheetCode)
    .order('created_at', { ascending: false })
    .limit(10)

  if (answersError || !answersData || answersData.length === 0) {
    console.error('Error fetching student answers:', answersError)
    return null
  }

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
      ...findWrongQuestionsForDay(day1Answer.answers, day1Exam.question_contents)
    )
  }

  // Erros do dia 2 (questões 91-180)
  if (day2Exam?.question_contents && day2Answer) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(day2Answer.answers, day2Exam.question_contents)
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

// Helper que usa índice relativo ao primeiro questionNumber do dia
function findWrongQuestionsForDay(
  studentAnswers: string[],
  questionContents: QuestionContent[] | null
): WrongQuestion[] {
  if (!questionContents || questionContents.length === 0) return []

  const wrongQuestions: WrongQuestion[] = []
  const firstQuestionNumber = questionContents[0].questionNumber

  for (const question of questionContents) {
    // Índice relativo ao primeiro número da questão do dia
    const answerIndex = question.questionNumber - firstQuestionNumber
    const studentAnswer = studentAnswers[answerIndex] ?? ''
    const correctAnswer = question.answer

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      wrongQuestions.push({
        questionNumber: question.questionNumber,
        topic: question.content,
        studentAnswer,
        correctAnswer,
      })
    }
  }

  return wrongQuestions
}

function groupByTopic(wrongQuestions: WrongQuestion[]): TopicSummary[] {
  const topicMap = new Map<string, { count: number; questions: number[] }>()

  for (const wq of wrongQuestions) {
    const existing = topicMap.get(wq.topic)
    if (existing) {
      existing.count++
      existing.questions.push(wq.questionNumber)
    } else {
      topicMap.set(wq.topic, {
        count: 1,
        questions: [wq.questionNumber],
      })
    }
  }

  return Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      questions: data.questions,
    }))
    .sort((a, b) => b.count - a.count) // Ordenar por mais erros
}

export async function analyzeStudentSimulado(
  matricula: string
): Promise<SimuladoResult | null> {
  // Tentar buscar simulado pela matrícula diretamente (formato mais comum)
  let result = await getLatestSimuladoResult(matricula)
  if (result) return result

  // Fallback: buscar pelo sheet_code do aluno
  const student = await getStudentByMatricula(matricula)
  if (student?.sheet_code) {
    result = await getLatestSimuladoResult(student.sheet_code)
  }

  return result
}
