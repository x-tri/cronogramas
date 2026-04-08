import type { QuestionContent, TopicSummary, WrongQuestion } from '../../types/supabase'
import { simuladoLog } from './logger'
import {
  getDetailedTopicByQuestionNumber,
  resolveQuestionTopic,
} from './question-topic'

export function calculateWrongQuestions(
  studentAnswers: string[],
  answerKey: string[],
  questionContents: QuestionContent[] | null,
  examId?: string | null,
): WrongQuestion[] {
  const wrongQuestions: WrongQuestion[] = []

  for (let i = 0; i < Math.min(studentAnswers.length, answerKey.length); i++) {
    const studentAnswer = studentAnswers[i]
    const correctAnswer = answerKey[i]
    const questionNumber = i + 1

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      const content = questionContents?.find(
        (qc) => qc.questionNumber === questionNumber,
      )

      wrongQuestions.push({
        examId: examId ?? null,
        questionNumber,
        topic: resolveQuestionTopic(content, questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }

  simuladoLog(`[calculateWrongQuestions] ${wrongQuestions.length} erros calculados`)
  return wrongQuestions
}

// Helper que usa índice relativo ao primeiro questionNumber do dia
export function findWrongQuestionsForDay(
  studentAnswers: string[],
  questionContents: QuestionContent[] | null,
  examId?: string | null,
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
        examId: examId ?? null,
        questionNumber: question.questionNumber,
        topic: resolveQuestionTopic(question, question.questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }

  return wrongQuestions
}

export function groupByTopic(wrongQuestions: WrongQuestion[]): TopicSummary[] {
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

// Helper: Distribui erros em questões específicas dentro de uma área
// Retorna um array de WrongQuestion com questões distribuídas
export function distributeErrorsInArea(
  startQuestion: number,
  endQuestion: number,
  errorCount: number,
): WrongQuestion[] {
  const questions: WrongQuestion[] = []

  // Calcular o intervalo entre questões para distribuir uniformemente
  const totalQuestions = endQuestion - startQuestion + 1
  const step = Math.max(1, Math.floor(totalQuestions / Math.max(1, errorCount)))

  // Gerar questões distribuídas pela área
  for (let i = 0; i < errorCount; i++) {
    // Calcular número da questão (distribuído uniformemente)
    const questionOffset = Math.min(i * step, totalQuestions - 1)
    const questionNumber = startQuestion + questionOffset

    questions.push({
      examId: null,
      questionNumber,
      topic: getDetailedTopicByQuestionNumber(questionNumber),
      studentAnswer: 'X',
      correctAnswer: '?',
    })
  }

  return questions
}

export { getDetailedTopicByQuestionNumber } from './question-topic'
