export type DifficultyTier = "facil" | "medio" | "dificil";

/**
 * Converte o campo `dificuldade` (parâmetro b da TRI, que vem como string no
 * JSON) em número. Ausente/vazio/inválido → null. Importante: Number(null) é 0
 * e Number("") é 0, por isso o guarda explícito.
 */
function parseB(d: number | string | null | undefined): number | null {
  if (d == null || d === "") return null;
  const n = typeof d === "string" ? Number(d) : d;
  return Number.isFinite(n) ? n : null;
}

/**
 * Cortes alinhados aos buckets do próprio pipeline (valores concentrados em
 * -0.5 / 0 / 0.5 / 1.5 / 2.5): b < 0.5 = fácil, 0.5 ≤ b < 1.5 = médio, b ≥ 1.5 = difícil.
 * Mostrar o número cru ao aluno não é explicável — usamos só o rótulo + a ordem.
 */
export function difficultyTier(
  d: number | string | null | undefined,
): DifficultyTier | null {
  const n = parseB(d);
  if (n == null) return null;
  if (n < 0.5) return "facil";
  if (n < 1.5) return "medio";
  return "dificil";
}

/** Comparador fácil → difícil; dificuldade ausente/inválida vai para o fim. */
export function byDifficultyAsc(
  a: { dificuldade?: number | string | null },
  b: { dificuldade?: number | string | null },
): number {
  const na = parseB(a.dificuldade) ?? Number.POSITIVE_INFINITY;
  const nb = parseB(b.dificuldade) ?? Number.POSITIVE_INFINITY;
  return na - nb;
}
