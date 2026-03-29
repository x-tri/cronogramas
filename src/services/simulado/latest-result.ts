import { simuladoSupabase as supabase } from '../../lib/simulado-supabase'
import type {
  Exam,
  QuestionContent,
  SimuladoHistoryItem,
  SimuladoResult,
  StudentAnswer,
  StudentAnswersSimuladoHistoryItem,
  WrongQuestion,
} from '../../types/supabase'
import { findWrongQuestionsForDay, groupByTopic } from './helpers'
import { simuladoLog } from './logger'

type ExamRecord = Pick<Exam, 'id' | 'title' | 'question_contents'>

type SimuladoAnswerGroup = {
  groupKey: string
  title: string
  date: string
  answerIds: string[]
  examIds: string[]
  answersByDay: Partial<Record<1 | 2, StudentAnswer>>
  examsByDay: Partial<Record<1 | 2, ExamRecord>>
  standaloneAnswers: StudentAnswer[]
  standaloneExams: ExamRecord[]
}

const DAY_GROUP_WINDOW_MS = 1000 * 60 * 60 * 24 * 7

function normalizeStudentNumber(studentNumber: string): string {
  return studentNumber.trim().replace(/^0+/, '') || '0'
}

function buildStudentNumberCandidates(studentNumber: string): string[] {
  const raw = studentNumber.trim()
  const normalized = normalizeStudentNumber(raw)
  return [...new Set([raw, normalized].filter(Boolean))]
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(dia|day)\s*[12]\b/g, ' ')
    .replace(/\b[12][ºo°]?\s*dia\b/g, ' ')
    .replace(/\bd\s*[12]\b/g, ' ')
    .replace(/[|\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripDayLabel(title: string): string {
  const stripped = title
    .replace(/\b(dia|day)\s*[12]\b/gi, ' ')
    .replace(/\b[12][ºo°]?\s*dia\b/gi, ' ')
    .replace(/\bd\s*[12]\b/gi, ' ')
    .replace(/[|\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return stripped || title.trim()
}

function inferDayFromExam(exam: ExamRecord | undefined): 1 | 2 | null {
  const firstQuestion = (exam?.question_contents as QuestionContent[] | null)?.[0]?.questionNumber

  if (firstQuestion === 1) return 1
  if (firstQuestion === 91) return 2
  return null
}

function areDatesClose(dateA: string, dateB: string): boolean {
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) <= DAY_GROUP_WINDOW_MS
}

async function fetchStudentAnswers(studentNumber: string): Promise<StudentAnswer[]> {
  const candidates = buildStudentNumberCandidates(studentNumber)
  simuladoLog('[listStudentAnswersSimulados] Buscando student_answers para:', candidates)

  const { data, error } = await supabase
    .from('student_answers')
    .select('*')
    .in('student_number', candidates)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listStudentAnswersSimulados] Error fetching student answers:', error)
    return []
  }

  return (data as StudentAnswer[] | null) ?? []
}

async function fetchExamsByIds(examIds: string[]): Promise<ExamRecord[]> {
  if (examIds.length === 0) return []

  const { data, error } = await supabase
    .from('exams')
    .select('id, title, question_contents')
    .in('id', examIds)

  if (error) {
    console.error('[listStudentAnswersSimulados] Error fetching exams:', error)
    return []
  }

  return (data as ExamRecord[] | null) ?? []
}

function buildStudentAnswersGroups(
  answers: StudentAnswer[],
  exams: ExamRecord[],
): SimuladoAnswerGroup[] {
  const examsMap = new Map(exams.map((exam) => [exam.id, exam]))
  const groups: SimuladoAnswerGroup[] = []

  for (const answer of answers) {
    const exam = examsMap.get(answer.exam_id)
    if (!exam) continue

    const day = inferDayFromExam(exam)
    const baseTitle = stripDayLabel(exam.title)
    const normalizedBaseTitle = normalizeTitle(baseTitle)

    if (day && normalizedBaseTitle) {
      const existingGroup = groups.find((group) => {
        return (
          group.groupKey === normalizedBaseTitle &&
          !group.answersByDay[day] &&
          areDatesClose(group.date, answer.created_at)
        )
      })

      if (existingGroup) {
        existingGroup.answersByDay[day] = answer
        existingGroup.examsByDay[day] = exam
        existingGroup.answerIds.push(answer.id)
        existingGroup.examIds.push(exam.id)
        if (new Date(answer.created_at).getTime() > new Date(existingGroup.date).getTime()) {
          existingGroup.date = answer.created_at
        }
        continue
      }
    }

    const groupKey =
      day && normalizedBaseTitle
        ? normalizedBaseTitle
        : `${exam.id}:${answer.id}`

    const group: SimuladoAnswerGroup = {
      groupKey,
      title: day && normalizedBaseTitle ? baseTitle : exam.title,
      date: answer.created_at,
      answerIds: [answer.id],
      examIds: [exam.id],
      answersByDay: {},
      examsByDay: {},
      standaloneAnswers: [],
      standaloneExams: [],
    }

    if (day && normalizedBaseTitle) {
      group.answersByDay[day] = answer
      group.examsByDay[day] = exam
    } else {
      group.standaloneAnswers.push(answer)
      group.standaloneExams.push(exam)
    }

    groups.push(group)
  }

  return groups.sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  )
}

function buildHistoryItemsFromGroups(
  groups: SimuladoAnswerGroup[],
): StudentAnswersSimuladoHistoryItem[] {
  return groups.map((group, index) => ({
    id: `student_answers:${group.groupKey}:${group.answerIds.join(',')}`,
    source: 'student_answers',
    title: group.title,
    date: group.date,
    isLatest: index === 0,
    answerIds: [...new Set(group.answerIds)],
    examIds: [...new Set(group.examIds)],
    groupKey: group.groupKey,
    studentNumber:
      group.answersByDay[2]?.student_number ??
      group.answersByDay[1]?.student_number ??
      group.standaloneAnswers[0]?.student_number ??
      '',
  }))
}

function buildSimuladoResultFromGroup(group: SimuladoAnswerGroup): SimuladoResult | null {
  const day1Answer = group.answersByDay[1] ?? null
  const day2Answer = group.answersByDay[2] ?? null
  const day1Exam = group.examsByDay[1] ?? null
  const day2Exam = group.examsByDay[2] ?? null
  const standaloneAnswer = group.standaloneAnswers[0] ?? null
  const standaloneExam = group.standaloneExams[0] ?? null

  const primaryAnswer = day2Answer ?? day1Answer ?? standaloneAnswer
  const primaryExam = day2Exam ?? day1Exam ?? standaloneExam

  if (!primaryAnswer || !primaryExam) return null

  const wrongQuestions: WrongQuestion[] = []

  if (day1Answer && day1Exam?.question_contents) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(
        day1Answer.answers,
        day1Exam.question_contents as QuestionContent[],
      ),
    )
  }

  if (day2Answer && day2Exam?.question_contents) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(
        day2Answer.answers,
        day2Exam.question_contents as QuestionContent[],
      ),
    )
  }

  if (standaloneAnswer && standaloneExam?.question_contents) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(
        standaloneAnswer.answers,
        standaloneExam.question_contents as QuestionContent[],
      ),
    )
  }

  const titleParts = [...new Set([day1Exam?.title, day2Exam?.title].filter(Boolean))]
  const title =
    titleParts.length > 0
      ? [...new Set(titleParts.map(stripDayLabel))].join(' + ')
      : standaloneExam?.title ?? primaryExam.title

  return {
    exam: {
      ...primaryExam,
      answer_key: [],
      title,
    },
    studentAnswer: primaryAnswer,
    wrongQuestions,
    topicsSummary: groupByTopic(wrongQuestions),
  }
}

function groupFromHistoryItem(
  item: StudentAnswersSimuladoHistoryItem,
  answers: StudentAnswer[],
  exams: ExamRecord[],
): SimuladoAnswerGroup {
  const examsMap = new Map(exams.map((exam) => [exam.id, exam]))
  const group: SimuladoAnswerGroup = {
    groupKey: item.groupKey,
    title: item.title,
    date: item.date,
    answerIds: [...item.answerIds],
    examIds: [...item.examIds],
    answersByDay: {},
    examsByDay: {},
    standaloneAnswers: [],
    standaloneExams: [],
  }

  for (const answer of answers) {
    const exam = examsMap.get(answer.exam_id)
    if (!exam) continue

    const day = inferDayFromExam(exam)
    const normalizedBaseTitle = normalizeTitle(stripDayLabel(exam.title))

    if (day && normalizedBaseTitle === item.groupKey) {
      group.answersByDay[day] = answer
      group.examsByDay[day] = exam
      continue
    }

    group.standaloneAnswers.push(answer)
    group.standaloneExams.push(exam)
  }

  return group
}

export async function listStudentAnswersSimulados(
  studentNumber: string,
): Promise<StudentAnswersSimuladoHistoryItem[]> {
  const answers = await fetchStudentAnswers(studentNumber)
  if (answers.length === 0) return []

  const examIds = [...new Set(answers.map((answer) => answer.exam_id))]
  const exams = await fetchExamsByIds(examIds)
  if (exams.length === 0) return []

  const groups = buildStudentAnswersGroups(answers, exams)
  return buildHistoryItemsFromGroups(groups)
}

export async function getStudentAnswersSimuladoResult(
  item: StudentAnswersSimuladoHistoryItem,
): Promise<SimuladoResult | null> {
  const { data: answersData, error: answersError } = await supabase
    .from('student_answers')
    .select('*')
    .in('id', item.answerIds)
    .order('created_at', { ascending: false })

  if (answersError) {
    console.error('[getStudentAnswersSimuladoResult] Error fetching answers:', answersError)
    return null
  }

  const answers = (answersData as StudentAnswer[] | null) ?? []
  if (answers.length === 0) return null

  const exams = await fetchExamsByIds(item.examIds)
  if (exams.length === 0) return null

  const group = groupFromHistoryItem(item, answers, exams)
  return buildSimuladoResultFromGroup(group)
}

export async function getLatestSimuladoResult(
  studentNumber: string,
): Promise<SimuladoResult | null> {
  const history = await listStudentAnswersSimulados(studentNumber)
  const latest = history[0]

  if (!latest) {
    simuladoLog('[getLatestSimuladoResult] Nenhuma resposta encontrada para:', studentNumber)
    return null
  }

  return getStudentAnswersSimuladoResult(latest)
}

export function isStudentAnswersHistoryItem(
  item: SimuladoHistoryItem,
): item is StudentAnswersSimuladoHistoryItem {
  return item.source === 'student_answers'
}
