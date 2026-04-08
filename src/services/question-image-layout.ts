import type { ReportData, QuestaoRecomendada } from '../types/report'

export interface QuestionImageLayout {
  readonly width: number
  readonly height: number
}

interface QuestionImageDimensions {
  readonly naturalWidthPx: number
  readonly naturalHeightPx: number
}

const PX_TO_PT = 0.75
const MAX_IMAGE_WIDTH_PT = 500
const MAX_IMAGE_HEIGHT_PT = 300
const FALLBACK_IMAGE_LAYOUT: QuestionImageLayout = {
  width: 260,
  height: 160,
}

export function buildQuestionImageLayoutKey(
  question: Pick<QuestaoRecomendada, 'ano' | 'coItem' | 'posicaoCaderno'>,
): string {
  return [
    question.ano,
    question.coItem,
    question.posicaoCaderno ?? 'sem-posicao',
  ].join(':')
}

export function calculateQuestionImageLayout(
  dimensions: QuestionImageDimensions | null,
): QuestionImageLayout {
  if (
    !dimensions ||
    !Number.isFinite(dimensions.naturalWidthPx) ||
    !Number.isFinite(dimensions.naturalHeightPx) ||
    dimensions.naturalWidthPx <= 0 ||
    dimensions.naturalHeightPx <= 0
  ) {
    return FALLBACK_IMAGE_LAYOUT
  }

  const naturalWidthPt = dimensions.naturalWidthPx * PX_TO_PT
  const naturalHeightPt = dimensions.naturalHeightPx * PX_TO_PT
  const scale = Math.min(
    1,
    MAX_IMAGE_WIDTH_PT / naturalWidthPt,
    MAX_IMAGE_HEIGHT_PT / naturalHeightPt,
  )

  return {
    width: Math.max(1, Math.round(naturalWidthPt * scale)),
    height: Math.max(1, Math.round(naturalHeightPt * scale)),
  }
}

async function loadImageDimensions(
  imageUrl: string,
): Promise<QuestionImageDimensions | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      resolve({
        naturalWidthPx: image.naturalWidth,
        naturalHeightPx: image.naturalHeight,
      })
    }
    image.onerror = () => resolve(null)
    image.src = imageUrl
  })
}

export async function loadQuestionImageLayouts(
  report: ReportData,
): Promise<Record<string, QuestionImageLayout>> {
  const questionsWithImages = report.questoesRecomendadas.habilidadesCriticas
    .flatMap((habilidade) => habilidade.questoesRecomendadas)
    .filter(
      (question) =>
        question.requiresVisualContext &&
        typeof question.imagemUrl === 'string' &&
        question.imagemUrl.trim().length > 0,
    )

  const layoutEntries = await Promise.all(
    questionsWithImages.map(async (question) => {
      const dimensions = await loadImageDimensions(question.imagemUrl as string)
      return [
        buildQuestionImageLayoutKey(question),
        calculateQuestionImageLayout(dimensions),
      ] as const
    }),
  )

  return Object.fromEntries(layoutEntries)
}

