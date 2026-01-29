export type SupabaseStudent = {
  id: string
  matricula: string
  name: string
  turma: string
  sheet_code: string
  school_id: string
}

export type StudentAnswer = {
  id: string
  exam_id: string
  student_number: string
  student_name: string | null
  turma: string | null
  answers: string[]
  score: number
  correct_answers: number
  wrong_answers: number
  blank_answers: number
  tri_score: number | null
  tri_lc: number | null
  tri_ch: number | null
  tri_cn: number | null
  tri_mt: number | null
  created_at: string
}

export type QuestionContent = {
  questionNumber: number
  answer: string
  content: string // tópico
}

export type Exam = {
  id: string
  title: string
  answer_key: string[]
  question_contents: QuestionContent[] | null
}

export type WrongQuestion = {
  questionNumber: number
  topic: string
  studentAnswer: string
  correctAnswer: string
}

export type SimuladoResult = {
  exam: Exam
  studentAnswer: StudentAnswer
  wrongQuestions: WrongQuestion[]
  topicsSummary: TopicSummary[]
}

export type TopicSummary = {
  topic: string
  count: number
  questions: number[]
}
