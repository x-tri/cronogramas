export interface RecommendationLike {
  readonly ano: number
  readonly dificuldade: number
  readonly posicaoCaderno: number | null
  readonly coItem: number
  readonly imagemUrl?: string | null
  readonly linkImagem?: string | null
  readonly alternativas?: ReadonlyArray<{
    readonly imagemUrl?: string | null
  }> | null
}

export interface PdfRecommendationLike extends RecommendationLike {
  readonly enunciado?: string | null
  readonly textoApoio?: string | null
  readonly requiresVisualContext?: boolean
  readonly alternativas?: ReadonlyArray<{
    readonly letra?: string
    readonly texto?: string | null
    readonly imagemUrl?: string | null
  }> | null
}

export type RecommendationQualityIssue =
  | 'visual_context_without_image'
  | 'empty_statement'
  | 'empty_option_without_image'
  | 'remote_image_not_embeddable'

export interface RecommendationQualityFinding {
  readonly key: string
  readonly issue: RecommendationQualityIssue
  readonly message: string
}

export interface DifficultyWindow {
  readonly target: number
  readonly min: number
  readonly max: number
}

type DifficultyBias = 'easier' | 'balanced' | 'harder'

export function getDifficultyWindowForTri(
  tri: number | null | undefined,
): DifficultyWindow {
  const target = tri != null ? (tri - 500) / 100 : 0

  if (tri == null) {
    return { target, min: target - 0.8, max: target + 0.8 }
  }

  if (tri < 560) {
    return { target, min: target - 0.9, max: target + 0.4 }
  }

  if (tri < 680) {
    return { target, min: target - 0.6, max: target + 0.9 }
  }

  return { target, min: target - 0.4, max: target + 1.3 }
}

export function buildRecommendationKey(
  item: RecommendationLike,
): string {
  return `${item.ano}:${item.posicaoCaderno ?? item.coItem}`
}

export function dedupeRecommendations<T extends RecommendationLike>(
  items: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const item of items) {
    const key = buildRecommendationKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

function getDifficultyBias(
  tri: number | null | undefined,
): DifficultyBias {
  if (tri == null) return 'balanced'
  if (tri < 560) return 'easier'
  if (tri >= 680) return 'harder'
  return 'balanced'
}

function hasQuestionImage(item: RecommendationLike): boolean {
  return Boolean(
    item.imagemUrl ??
    item.linkImagem ??
    item.alternativas?.some((alternativa) => alternativa.imagemUrl),
  )
}

function hasTrustedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.length > 0
  } catch {
    return false
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function textMentionsVisualContext(item: PdfRecommendationLike): boolean {
  const text = normalizeText([item.enunciado, item.textoApoio].filter(Boolean).join(' '))
  return [
    'figura',
    'imagem',
    'grafico',
    'tabela',
    'mapa',
    'charge',
    'cartaz',
    'esquema',
    'diagrama',
    'infografico',
  ].some((keyword) => text.includes(keyword))
}

function hasRemoteImage(item: PdfRecommendationLike): boolean {
  return Boolean(
    hasTrustedImageUrl(item.imagemUrl) ||
    hasTrustedImageUrl(item.linkImagem) ||
    item.alternativas?.some((alternativa) => hasTrustedImageUrl(alternativa.imagemUrl)),
  )
}

export function auditPdfRecommendationQuality(
  item: PdfRecommendationLike,
): RecommendationQualityFinding[] {
  const key = buildRecommendationKey(item)
  const findings: RecommendationQualityFinding[] = []
  const hasStatement = Boolean(item.enunciado?.trim() || item.textoApoio?.trim())
  const hasVisualImage = hasTrustedImageUrl(item.imagemUrl) || hasTrustedImageUrl(item.linkImagem)
  const hasOptionImage = Boolean(
    item.alternativas?.some((alternativa) => hasTrustedImageUrl(alternativa.imagemUrl)),
  )
  const requiresVisualContext = Boolean(item.requiresVisualContext || textMentionsVisualContext(item))

  if (!hasStatement) {
    findings.push({
      key,
      issue: 'empty_statement',
      message: 'Questão recomendada sem enunciado/texto de apoio.',
    })
  }

  if (requiresVisualContext && !hasVisualImage && !hasOptionImage) {
    findings.push({
      key,
      issue: 'visual_context_without_image',
      message: 'Questão depende de contexto visual, mas não possui imagem confiável.',
    })
  }

  if (requiresVisualContext || hasRemoteImage(item)) {
    findings.push({
      key,
      issue: 'remote_image_not_embeddable',
      message: 'Questão depende de imagem remota que o PDF do navegador não embute com segurança.',
    })
  }

  for (const alternativa of item.alternativas ?? []) {
    if (!alternativa.texto?.trim() && !hasTrustedImageUrl(alternativa.imagemUrl)) {
      findings.push({
        key,
        issue: 'empty_option_without_image',
        message: `Alternativa ${alternativa.letra ?? '?'} sem texto e sem imagem.`,
      })
    }
  }

  return findings
}

export function filterPdfSafeRecommendations<T extends PdfRecommendationLike>(
  items: ReadonlyArray<T>,
): T[] {
  return items.filter((item) => auditPdfRecommendationQuality(item).length === 0)
}

export function sortRecommendationsByStudentLevel<T extends RecommendationLike>(
  items: ReadonlyArray<T>,
  tri: number | null | undefined,
): T[] {
  const { target } = getDifficultyWindowForTri(tri)
  const bias = getDifficultyBias(tri)

  return [...items].sort((left, right) => {
    const leftSide =
      bias === 'easier'
        ? left.dificuldade <= target ? 0 : 1
        : bias === 'harder'
          ? left.dificuldade >= target ? 0 : 1
          : 0
    const rightSide =
      bias === 'easier'
        ? right.dificuldade <= target ? 0 : 1
        : bias === 'harder'
          ? right.dificuldade >= target ? 0 : 1
          : 0

    if (leftSide !== rightSide) {
      return leftSide - rightSide
    }

    const leftHasImage = hasQuestionImage(left) ? 0 : 1
    const rightHasImage = hasQuestionImage(right) ? 0 : 1
    if (leftHasImage !== rightHasImage) {
      return leftHasImage - rightHasImage
    }

    const leftDistance = Math.abs(left.dificuldade - target)
    const rightDistance = Math.abs(right.dificuldade - target)

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    if (left.dificuldade !== right.dificuldade) {
      return left.dificuldade - right.dificuldade
    }

    if (left.ano !== right.ano) {
      return right.ano - left.ano
    }

    return buildRecommendationKey(left).localeCompare(
      buildRecommendationKey(right),
    )
  })
}

export function pickRecommendationsForStudent<T extends RecommendationLike>(
  items: ReadonlyArray<T>,
  tri: number | null | undefined,
  limit: number,
): T[] {
  const deduped = dedupeRecommendations(items)
  const { min, max } = getDifficultyWindowForTri(tri)

  const insideWindow = deduped.filter(
    (item) => item.dificuldade >= min && item.dificuldade <= max,
  )
  const outsideWindow = deduped.filter(
    (item) => item.dificuldade < min || item.dificuldade > max,
  )

  return [
    ...sortRecommendationsByStudentLevel(insideWindow, tri),
    ...sortRecommendationsByStudentLevel(outsideWindow, tri),
  ].slice(0, limit)
}

export function mergeRecommendationsForStudent<T extends RecommendationLike>(
  primary: ReadonlyArray<T>,
  fallback: ReadonlyArray<T>,
  tri: number | null | undefined,
  limit: number,
  fallbackLimit = limit,
): T[] {
  const pickedPrimary = pickRecommendationsForStudent(primary, tri, limit)
  const seen = new Set(pickedPrimary.map(buildRecommendationKey))
  const pickedFallback = pickRecommendationsForStudent(
    fallback,
    tri,
    Math.max(limit * 2, fallbackLimit),
  )
    .filter((item) => !seen.has(buildRecommendationKey(item)))
    .slice(0, fallbackLimit)

  return [...pickedPrimary, ...pickedFallback].slice(0, limit)
}
