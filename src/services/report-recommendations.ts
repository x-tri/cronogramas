export interface RecommendationLike {
  readonly ano: number
  readonly dificuldade: number
  readonly posicaoCaderno: number | null
  readonly coItem: number
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
