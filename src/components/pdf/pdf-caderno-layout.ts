// Layout do caderno de questões — estimativa de altura e empacotamento.
//
// Problema (caderno da Nicole, 2026-06-11, 22 páginas): as questões eram
// pareadas na ordem de chegada com wrap={false} por par. Um par "curta+alta"
// desperdiça a coluna da curta, e um par alto que não cabe no fim da página
// empurra a página inteira — páginas com 60% de branco.
//
// Solução: estimar a altura de cada card e parear alturas semelhantes,
// ordenando linhas da mais alta para a mais baixa (linhas curtas no fim
// aproveitam sobras de página).

import type { QuestaoRecomendada } from '../../types/report'
import { shouldRenderQuestionImage } from '../../services/question-delivery'
import {
  buildQuestionImageLayoutKey,
  DEFAULT_QUESTION_IMAGE_LAYOUT,
  type QuestionImageLayout,
} from '../../services/question-image-layout'

export const MAX_COLUMN_VISUAL_WIDTH_PT = 340
export const MAX_COLUMN_VISUAL_HEIGHT_PT = 280
export const COLUMN_IMAGE_HEIGHT_PT = 220

export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  if (/^data:image\/(png|jpe?g|gif|bmp|webp);base64,/i.test(trimmed)) {
    return true
  }
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return /\.(png|jpe?g|gif|bmp|webp)$/i.test(u.pathname)
  } catch {
    return false
  }
}

export function shouldRenderVisualImage(question: QuestaoRecomendada): boolean {
  return (
    isValidImageUrl(question.imagemUrl) &&
    (
      question.imagemUrl.startsWith('data:image/') ||
      shouldRenderQuestionImage(question)
    )
  )
}

function resolveImageLayout(
  question: QuestaoRecomendada,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): QuestionImageLayout {
  return (
    imageLayoutByQuestionKey[buildQuestionImageLayoutKey(question)] ??
    DEFAULT_QUESTION_IMAGE_LAYOUT
  )
}

export function shouldUseFullWidthQuestion(
  question: QuestaoRecomendada,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): boolean {
  if (!shouldRenderVisualImage(question)) {
    return false
  }

  const layout = resolveImageLayout(question, imageLayoutByQuestionKey)

  return (
    layout.width > MAX_COLUMN_VISUAL_WIDTH_PT ||
    layout.height > MAX_COLUMN_VISUAL_HEIGHT_PT
  )
}

// Constantes da heurística de altura (coluna ~265pt de largura útil,
// fontes 7-8pt). Não precisam ser exatas — o que importa é a ORDEM relativa.
const CARD_CHROME_PT = 34 // header + bordas + margens internas
const APOIO_CHARS_PER_LINE = 62
const APOIO_LINE_PT = 10.5
const APOIO_MAX_CHARS = 900 // truncateTextoApoio
const ENUNCIADO_CHARS_PER_LINE = 58
const ENUNCIADO_LINE_PT = 12
const ALT_CHARS_PER_LINE = 52
const ALT_LINE_PT = 11.2
const ALT_IMAGE_PT = 30
const IMAGE_PADDING_PT = 10

function textLines(text: string | null | undefined, charsPerLine: number): number {
  const clean = (text ?? '').trim()
  if (!clean) return 0
  // quebras explícitas contam como linhas próprias
  return clean
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
}

/** Altura estimada (pt) de um card de questão no modo coluna. */
export function estimateQuestionCardHeight(
  question: QuestaoRecomendada,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): number {
  let height = CARD_CHROME_PT

  const apoio = (question.textoApoio ?? '').slice(0, APOIO_MAX_CHARS)
  height += textLines(apoio, APOIO_CHARS_PER_LINE) * APOIO_LINE_PT

  height += textLines(question.enunciado, ENUNCIADO_CHARS_PER_LINE) * ENUNCIADO_LINE_PT

  if (shouldRenderVisualImage(question)) {
    const layout = resolveImageLayout(question, imageLayoutByQuestionKey)
    height += Math.min(layout.height, COLUMN_IMAGE_HEIGHT_PT) + IMAGE_PADDING_PT
  }

  for (const alt of question.alternativas ?? []) {
    height += alt.imagemUrl
      ? ALT_IMAGE_PT
      : Math.max(1, textLines(alt.texto, ALT_CHARS_PER_LINE)) * ALT_LINE_PT
  }

  return height
}

export type AreaQuestionRow =
  | { readonly kind: 'full'; readonly items: readonly [QuestaoRecomendada] }
  | {
      readonly kind: 'columns'
      readonly items: readonly [QuestaoRecomendada, QuestaoRecomendada | null]
    }

/**
 * Monta as linhas da área: questões de imagem grande em largura total
 * primeiro; as demais ordenadas por altura estimada (desc) e pareadas com a
 * vizinha de altura mais próxima — pares homogêneos minimizam o branco
 * intra-linha, e linhas curtas no fim aproveitam as sobras de página.
 */
export function buildAreaQuestionRows(
  questions: ReadonlyArray<QuestaoRecomendada>,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): AreaQuestionRow[] {
  const fulls: QuestaoRecomendada[] = []
  const columns: QuestaoRecomendada[] = []

  for (const question of questions) {
    if (shouldUseFullWidthQuestion(question, imageLayoutByQuestionKey)) {
      fulls.push(question)
    } else {
      columns.push(question)
    }
  }

  const sorted = [...columns].sort(
    (left, right) =>
      estimateQuestionCardHeight(right, imageLayoutByQuestionKey) -
      estimateQuestionCardHeight(left, imageLayoutByQuestionKey),
  )

  const rows: AreaQuestionRow[] = fulls.map(
    (question) => ({ kind: 'full', items: [question] }) as const,
  )

  for (let index = 0; index < sorted.length; index += 2) {
    rows.push({
      kind: 'columns',
      items: [sorted[index], sorted[index + 1] ?? null],
    })
  }

  return rows
}
