/**
 * Extração e deduplicação de tópicos a estudar a partir das respostas
 * do aluno comparadas ao gabarito.
 *
 * Regra crítica (constraint do produto): se o aluno errou 3 questões
 * de "Genética", o cronograma deve ter 1 bloco "Genética", não 3.
 */

import { getDetailedTopicByQuestionNumber } from '../../../src/services/simulado/question-topic'

export interface WrongQuestionRef {
  readonly questionNumber: number
  readonly studentAnswer: string
  readonly correctAnswer: string
  readonly topicLabel: string // "Q15 - Gramática (Sintaxe)"
  readonly topicKey: string // "gramatica-sintaxe" — usado para dedup
  readonly topicDisplay: string // "Gramática (Sintaxe)" — display sem o Q\d+ -
}

export interface DedupedTopic {
  readonly topicKey: string
  readonly topicDisplay: string
  readonly questionNumbers: readonly number[] // questões que caíram neste tópico
  readonly errorCount: number // = questionNumbers.length, atalho para priorização
}

/**
 * Compara `answers[]` do aluno com `answerKey[]` e retorna lista de questões
 * erradas com seus tópicos resolvidos via mapping por número.
 *
 * Trata como ERRO apenas respostas em {A,B,C,D,E} que diferem do gabarito.
 * Brancos (NULL, "X", "*", "-", vazio) são ignorados — não geram bloco de estudo.
 */
export function extractWrongQuestions(
  answers: readonly string[] | null | undefined,
  answerKey: readonly string[] | null | undefined,
): WrongQuestionRef[] {
  if (!answers || !answerKey || answers.length === 0 || answerKey.length === 0) {
    return []
  }

  const wrong: WrongQuestionRef[] = []
  const len = Math.min(answers.length, answerKey.length)

  for (let i = 0; i < len; i++) {
    const ans = answers[i]
    const correct = answerKey[i]
    if (!ans || !['A', 'B', 'C', 'D', 'E'].includes(ans)) continue
    if (ans === correct) continue

    const questionNumber = i + 1
    const topicLabel = getDetailedTopicByQuestionNumber(questionNumber)
    const { display, key } = parseTopicLabel(topicLabel)

    wrong.push({
      questionNumber,
      studentAnswer: ans,
      correctAnswer: correct,
      topicLabel,
      topicKey: key,
      topicDisplay: display,
    })
  }

  return wrong
}

/**
 * Dedup de tópicos. Mantém a ordem de primeira ocorrência. Para tópicos
 * com múltiplas questões erradas, agrega a lista de question numbers
 * (útil para descrição do bloco e priorização).
 */
export function dedupTopics(wrongQuestions: readonly WrongQuestionRef[]): DedupedTopic[] {
  const byKey = new Map<string, { display: string; questions: number[] }>()

  for (const wq of wrongQuestions) {
    const existing = byKey.get(wq.topicKey)
    if (existing) {
      existing.questions.push(wq.questionNumber)
    } else {
      byKey.set(wq.topicKey, {
        display: wq.topicDisplay,
        questions: [wq.questionNumber],
      })
    }
  }

  return Array.from(byKey.entries()).map(([topicKey, { display, questions }]) => ({
    topicKey,
    topicDisplay: display,
    questionNumbers: questions,
    errorCount: questions.length,
  }))
}

/**
 * Remove prefixo "Q\\d+ - " e normaliza para key estável de dedup.
 *
 * "Q15 - Gramática (Sintaxe)" -> { display: "Gramática (Sintaxe)", key: "gramatica-sintaxe" }
 * "Q67 - Geografia (Espaço e Território)" -> idem normalizado
 */
export function parseTopicLabel(label: string): { display: string; key: string } {
  const display = label.replace(/^Q\d+\s*-\s*/, '').trim()
  const key = display
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return { display, key }
}

/**
 * Mapeia tópico para área ENEM via número de questão de origem.
 * (LC=1-45, CH=46-90, CN=91-135, MT=136-180)
 */
export function areaForQuestion(questionNumber: number): 'LC' | 'CH' | 'CN' | 'MT' {
  if (questionNumber <= 45) return 'LC'
  if (questionNumber <= 90) return 'CH'
  if (questionNumber <= 135) return 'CN'
  return 'MT'
}
