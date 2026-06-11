import { describe, expect, it } from 'vitest'

import {
  normalizeAlternativeText,
  sanitizeQuestionText,
  summarizeTriCalibration,
} from './pdf-question-text'

// Casos reais extraídos do caderno da Isabela (2026-04-08) — diagramação
// quebrada que motivou o fix: markdown cru, letra duplicada nas alternativas
// e cabeçalho afirmando calibração TRI para questões de fallback.

describe('sanitizeQuestionText', () => {
  it('remove markdown de negrito que vazava cru no PDF', () => {
    expect(
      sanitizeQuestionText('**Girassol da madrugada**Teu dedo curioso me segue'),
    ).toBe('Girassol da madrugada Teu dedo curioso me segue')
    expect(
      sanitizeQuestionText('VIEIRA JR., I.** Torto arado**. São Paulo: Todavia, 2019.'),
    ).toBe('VIEIRA JR., I. Torto arado. São Paulo: Todavia, 2019.')
  })

  it('continua removendo imagens markdown', () => {
    expect(sanitizeQuestionText('Veja: ![grafico](https://x.com/a.png) acima')).toBe(
      'Veja: acima',
    )
  })

  it('não toca asteriscos isolados (multiplicação em MT)', () => {
    expect(sanitizeQuestionText('3 * 4 = 12')).toBe('3 * 4 = 12')
  })

  // Cicatrizes restantes no caderno da Nicole (4), 2026-06-11:
  it('remove itálico markdown de underscore sem quebrar subscritos', () => {
    expect(
      sanitizeQuestionText('_Mindset_, empoderamento, _millennials_, _networking_, coworking'),
    ).toBe('Mindset, empoderamento, millennials, networking, coworking')
    // subscrito matemático não é par de itálico
    expect(sanitizeQuestionText('x_1 + y_2 = z')).toBe('x_1 + y_2 = z')
  })

  it('remove escapes de barra invertida em pontuação', () => {
    expect(sanitizeQuestionText('velho Chico Lourenço \\[seu pai\\].')).toBe(
      'velho Chico Lourenço [seu pai].',
    )
    expect(sanitizeQuestionText('pedante e chato. \\[…\\]')).toBe('pedante e chato. […]')
  })

  it('remove espaço órfão antes de pontuação (sobra do **)', () => {
    expect(sanitizeQuestionText('**Tudo sobre arte**. Rio de Janeiro')).toBe(
      'Tudo sobre arte. Rio de Janeiro',
    )
    expect(sanitizeQuestionText('KEYS, A. **Here**. Estados Unidos')).toBe(
      'KEYS, A. Here. Estados Unidos',
    )
  })

  it('colapsa espaços múltiplos resultantes da limpeza', () => {
    expect(sanitizeQuestionText('a  b\t c')).toBe('a b c')
  })

  it('entrada nula vira string vazia', () => {
    expect(sanitizeQuestionText(null)).toBe('')
    expect(sanitizeQuestionText(undefined)).toBe('')
  })
})

describe('normalizeAlternativeText', () => {
  // Questão 2 do caderno-modelo: "A) A e videnciar a importância..." —
  // o texto da alternativa veio com a própria letra + primeira sílaba
  // descolada (OCR). O PDF prepende a letra de novo.
  it('remove letra duplicada e religa a sílaba descolada (assinatura OCR)', () => {
    expect(normalizeAlternativeText('A', 'A e videnciar a importância de uma rede de apoio')).toBe(
      'evidenciar a importância de uma rede de apoio',
    )
    expect(normalizeAlternativeText('B', 'B d enunciar a disparidade entre o trabalho')).toBe(
      'denunciar a disparidade entre o trabalho',
    )
    expect(normalizeAlternativeText('C', 'C r essaltar o fechamento de escolas')).toBe(
      'ressaltar o fechamento de escolas',
    )
  })

  it('remove prefixos explícitos de letra (A), A., (A))', () => {
    expect(normalizeAlternativeText('A', 'A) repúdio ao sotaque espanhol')).toBe(
      'repúdio ao sotaque espanhol',
    )
    expect(normalizeAlternativeText('B', 'B. resignação diante do apagamento')).toBe(
      'resignação diante do apagamento',
    )
    expect(normalizeAlternativeText('C', '(C) escassez de oportunidades')).toBe(
      'escassez de oportunidades',
    )
  })

  it('NÃO remove artigo legítimo no início da alternativa', () => {
    // "A Maria foi..." na alternativa A: o "A" é artigo, não letra duplicada
    expect(normalizeAlternativeText('A', 'A Constituição garante o direito')).toBe(
      'A Constituição garante o direito',
    )
    expect(normalizeAlternativeText('A', 'a defesa da igualdade de gêneros.')).toBe(
      'a defesa da igualdade de gêneros.',
    )
  })

  it('letra diferente da alternativa não é tratada como duplicata', () => {
    expect(normalizeAlternativeText('B', 'A) texto qualquer')).toBe('A) texto qualquer')
  })

  it('texto normal passa intacto', () => {
    expect(normalizeAlternativeText('E', 'concorrência entre as variações linguísticas')).toBe(
      'concorrência entre as variações linguísticas',
    )
  })
})

describe('summarizeTriCalibration', () => {
  const q = (selectionSource: string, dificuldade: number) => ({
    selectionSource,
    dificuldade,
  })

  it('separa calibradas de complementares do fallback de área', () => {
    const questoes = [
      q('question_topic', 0.5),
      q('same_skill', -0.2),
      q('same_skill', 1.1),
      q('area_fallback', 0.5),
      q('area_fallback', -1.5),
    ]

    expect(summarizeTriCalibration(questoes)).toEqual({ calibradas: 3, complementares: 2 })
  })

  it('questão sem param_b real (dificuldade 0) não conta como calibrada', () => {
    const questoes = [q('same_skill', 0), q('same_skill', 0.7)]

    expect(summarizeTriCalibration(questoes)).toEqual({ calibradas: 1, complementares: 1 })
  })
})
