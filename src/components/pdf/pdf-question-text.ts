// Saneamento de texto para o PDF do caderno de questões — corrige os defeitos
// de diagramação observados nos cadernos gerados (2026-06-11): markdown cru,
// letra da alternativa duplicada com sílaba descolada (OCR) e cabeçalho
// afirmando calibração TRI para questões de fallback.

/**
 * Limpa texto de enunciado/apoio para renderização no PDF:
 * - remove imagens markdown `![alt](url)` (vazavam como texto cru)
 * - remove marcadores de negrito `**...**` (apareciam literais no papel);
 *   asteriscos isolados são preservados (multiplicação em MT)
 * - colapsa espaços múltiplos e quebras excessivas
 */
export function sanitizeQuestionText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\*\*/g, ' ')
    // itálico markdown `_..._` — só quando o underscore abre após
    // início/espaço/parêntese e fecha antes de espaço/pontuação, para não
    // tocar subscritos matemáticos como x_1
    .replace(/(^|[\s(])_([^_\n]+?)_(?=$|[\s).,;:!?])/gm, '$1$2')
    // escapes de barra invertida vazados do markdown: \[ \] \( \) etc.
    .replace(/\\([[\]().,;:!?*_-])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    // espaço órfão antes de pontuação (sobra da remoção do **)
    .replace(/ +([.,;:!?])/g, '$1')
    .trim()
}

/**
 * Normaliza o texto de uma alternativa antes de prefixar a letra no PDF.
 *
 * Fonte do problema: questões extraídas por OCR chegam com a própria letra
 * embutida no texto e a primeira sílaba descolada — ex.: alternativa A com
 * texto "A e videnciar a importância..." renderizava "A) A e videnciar".
 *
 * Regras (conservadoras, para não comer artigo "A"/"a" legítimo):
 * 1. Prefixo explícito `A)` / `A.` / `(A)` igual à letra → remove.
 * 2. Letra solta MAIÚSCULA igual à letra da alternativa, seguida de UMA letra
 *    minúscula descolada + palavra (assinatura do OCR) → remove a letra e
 *    religa a sílaba ("A e videnciar" → "evidenciar").
 *    "A Constituição..." (artigo + palavra normal) NÃO casa com a assinatura.
 */
export function normalizeAlternativeText(
  letra: string,
  texto: string | null | undefined,
): string {
  const clean = sanitizeQuestionText(texto)
  if (!clean) return ''

  const upper = letra.toUpperCase()

  // Regra 1: prefixo explícito com a mesma letra
  const explicitPrefix = new RegExp(`^\\(?${upper}[).]\\s*`, 'u')
  if (explicitPrefix.test(clean)) {
    return clean.replace(explicitPrefix, '').trim()
  }

  // Regra 2: assinatura OCR — "A e videnciar ..." (letra + sílaba descolada)
  const ocrSignature = new RegExp(
    `^${upper}\\s+(\\p{Ll})\\s+(\\p{Ll}\\S*)`,
    'u',
  )
  const match = clean.match(ocrSignature)
  if (match) {
    const rejoined = `${match[1]}${match[2]}`
    return clean.replace(ocrSignature, rejoined).trim()
  }

  return clean
}

export interface TriCalibrationSummary {
  readonly calibradas: number
  readonly complementares: number
}

/**
 * Conta quantas questões da área foram de fato calibradas pelo TRI do aluno
 * (param_b real dos microdados) versus complementares (fallback de área com
 * dificuldade textual, ou sem param_b). Usado no cabeçalho da área para o
 * caderno ser honesto sobre a própria calibração.
 */
export function summarizeTriCalibration(
  questoes: ReadonlyArray<{
    readonly selectionSource?: string | null
    readonly dificuldade: number
  }>,
): TriCalibrationSummary {
  let calibradas = 0
  let complementares = 0

  for (const questao of questoes) {
    const isFallback = questao.selectionSource === 'area_fallback'
    const hasRealParamB = questao.dificuldade !== 0

    if (!isFallback && hasRealParamB) {
      calibradas += 1
    } else {
      complementares += 1
    }
  }

  return { calibradas, complementares }
}
