// Helpers puros da visão executiva (Fase 2 — acurácia).

/** Cobertura "atendidos/base" em % pt-BR; null quando a base é desconhecida. */
export function coveragePercent(
  atendidos: number,
  base: number,
): string | null {
  if (!base || base <= 0) return null
  const pct = (atendidos / base) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Mediana simples; null para lista vazia. */
export function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
