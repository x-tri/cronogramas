import type { ReportData, QuestaoRecomendada } from '../types/report'
import { filterPdfSafeRecommendations } from './report-recommendations'

const QUESTION_IMAGE_PROXY_PATH = '/question-image-proxy.php'
const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

function isDataImageUrl(url: string): boolean {
  return /^data:image\/(png|jpe?g|gif|bmp|webp);base64,/i.test(url.trim())
}

function getAllowedQuestionImageExtension(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'api.questoes.xtri.online' ||
      !parsed.pathname.startsWith('/media/enem/')
    ) {
      return null
    }

    const match = parsed.pathname.match(/\.([a-z0-9]+)$/i)
    const extension = match?.[1]?.toLowerCase() ?? ''
    return IMAGE_MIME_BY_EXTENSION[extension] ? extension : null
  } catch {
    return null
  }
}

export function buildQuestionImageProxyUrl(sourceUrl: string): string | null {
  if (!getAllowedQuestionImageExtension(sourceUrl)) {
    return null
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${QUESTION_IMAGE_PROXY_PATH}?url=${encodeURIComponent(sourceUrl)}`
}

async function responseToDataUrl(response: Response, fallbackMime: string): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''
  const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : fallbackMime
  if (!mime.startsWith('image/')) return null

  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize))
  }

  return `data:${mime};base64,${btoa(binary)}`
}

async function fetchImageDataUrl(sourceUrl: string): Promise<string | null> {
  if (isDataImageUrl(sourceUrl)) return sourceUrl

  const extension = getAllowedQuestionImageExtension(sourceUrl)
  const fallbackMime = extension ? IMAGE_MIME_BY_EXTENSION[extension] : null
  const proxyUrl = buildQuestionImageProxyUrl(sourceUrl)
  const candidates = [
    proxyUrl,
    sourceUrl,
  ].filter((url): url is string => Boolean(url))

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: 'force-cache' })
      if (!response.ok) continue

      const dataUrl = await responseToDataUrl(response, fallbackMime ?? 'image/png')
      if (dataUrl) return dataUrl
    } catch {
      // Tenta a proxima origem. A API de questoes nao envia CORS para media,
      // entao em producao o caminho esperado e o proxy PHP no mesmo dominio.
    }
  }

  return null
}

function getQuestionImageUrls(question: QuestaoRecomendada): string[] {
  return [
    question.imagemUrl,
    question.linkImagem,
    ...(question.alternativas ?? []).map((alternativa) => alternativa.imagemUrl ?? null),
  ].filter((url): url is string => Boolean(url?.trim()))
}

async function embedQuestionImages(
  question: QuestaoRecomendada,
  imageCache: Map<string, Promise<string | null>>,
): Promise<QuestaoRecomendada> {
  const resolveImage = (url: string | null | undefined): Promise<string | null> => {
    if (!url) return Promise.resolve(null)
    const existing = imageCache.get(url)
    if (existing) return existing
    const promise = fetchImageDataUrl(url)
    imageCache.set(url, promise)
    return promise
  }

  const [imagemUrl, linkImagem, alternativas] = await Promise.all([
    resolveImage(question.imagemUrl),
    resolveImage(question.linkImagem),
    Promise.all(
      (question.alternativas ?? []).map(async (alternativa) => ({
        ...alternativa,
        imagemUrl: await resolveImage(alternativa.imagemUrl),
      })),
    ),
  ])

  return {
    ...question,
    imagemUrl,
    linkImagem,
    alternativas,
  }
}

export async function embedQuestionPdfImages(report: ReportData): Promise<ReportData> {
  const uniqueImageUrls = new Set(
    report.questoesRecomendadas.habilidadesCriticas
      .flatMap((habilidade) => habilidade.questoesRecomendadas)
      .flatMap(getQuestionImageUrls),
  )

  if (uniqueImageUrls.size === 0) {
    return report
  }

  const imageCache = new Map<string, Promise<string | null>>()
  const habilidadesCriticas = await Promise.all(
    report.questoesRecomendadas.habilidadesCriticas.map(async (habilidade) => {
      const embeddedQuestions = await Promise.all(
        habilidade.questoesRecomendadas.map((question) =>
          embedQuestionImages(question, imageCache),
        ),
      )

      return {
        ...habilidade,
        questoesRecomendadas: filterPdfSafeRecommendations(embeddedQuestions),
      }
    }),
  )

  return {
    ...report,
    questoesRecomendadas: {
      ...report.questoesRecomendadas,
      habilidadesCriticas,
    },
  }
}
