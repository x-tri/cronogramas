import { describe, expect, it } from 'vitest'
import type { QuestaoRecomendada } from '../types/report'
import {
  resolveQuestionContentLabel,
  summarizeAreaFocus,
} from './question-content-label'

function buildQuestion(
  overrides: Partial<QuestaoRecomendada> = {},
): QuestaoRecomendada {
  return {
    coItem: 1,
    ano: 2024,
    area: 'CH',
    habilidade: 1,
    matchedTopicLabel: 'Filosofia Helenística - Estoicismo',
    selectionSource: 'same_topic',
    sourceExam: 'ENEM',
    sourceExamUsed: 'ENEM',
    dificuldade: 0,
    discriminacao: 0,
    linkImagem: null,
    gabarito: 'A',
    posicaoCaderno: 1,
    enunciado: 'Texto da questão',
    textoApoio: null,
    alternativas: null,
    imagemUrl: null,
    requiresVisualContext: false,
    resolutionStatus: 'resolved',
    wasSubstituted: false,
    ...overrides,
  }
}

describe('resolveQuestionContentLabel', () => {
  it('mantém o rótulo quando a seleção veio de same_topic', () => {
    const question = buildQuestion({
      enunciado: 'O estoicismo defendia a moderação das paixões como ideal de vida.',
    })

    expect(resolveQuestionContentLabel(question)).toBe(
      'Filosofia Helenística - Estoicismo',
    )
  })

  it('remove o rótulo quando a seleção veio de same_skill', () => {
    const question = buildQuestion({
      selectionSource: 'same_skill',
    })

    expect(resolveQuestionContentLabel(question)).toBeNull()
  })

  it('remove o rótulo quando a seleção veio de area_fallback', () => {
    const question = buildQuestion({
      selectionSource: 'area_fallback',
      matchedTopicLabel: null,
    })

    expect(resolveQuestionContentLabel(question)).toBeNull()
  })

  it('remove o rótulo quando ele é sintético ou vazio', () => {
    const question = buildQuestion({
      matchedTopicLabel: 'Q12 - Conteúdo provisório',
    })

    expect(resolveQuestionContentLabel(question)).toBeNull()
  })

  it('remove o rótulo quando só há termo amplo da disciplina no texto', () => {
    const question = buildQuestion({
      enunciado: 'Descartes discute a filosofia como árvore do conhecimento.',
      textoApoio: null,
    })

    expect(resolveQuestionContentLabel(question)).toBeNull()
  })

  it('mantém o rótulo quando o texto contém termo específico do tópico', () => {
    const question = buildQuestion({
      matchedTopicLabel: 'Genetica',
      area: 'CN',
      enunciado: 'O organismo geneticamente modificado apresenta resistência ao vírus.',
      textoApoio: null,
    })

    expect(resolveQuestionContentLabel(question)).toBe('Genetica')
  })

  it('confirma o foco da área quando há dominância forte do mesmo tópico', () => {
    const questions = Array.from({ length: 10 }, () =>
      buildQuestion({
        area: 'CN',
        matchedTopicLabel: 'Genetica',
        enunciado: 'A genética molecular explica a transmissão hereditária.',
      }),
    )

    expect(summarizeAreaFocus(questions)).toEqual({
      label: 'Genetica',
      validatedCount: 10,
      totalCount: 10,
    })
  })

  it('não confirma o foco da área quando o tópico validado não domina o conjunto', () => {
    const questions = [
      ...Array.from({ length: 6 }, () =>
        buildQuestion({
          area: 'CN',
          matchedTopicLabel: 'Genetica',
          enunciado: 'A genética molecular explica a transmissão hereditária.',
        }),
      ),
      ...Array.from({ length: 4 }, () =>
        buildQuestion({
          area: 'CN',
          matchedTopicLabel: null,
          selectionSource: 'same_skill',
          enunciado: 'Questão de outra subárea sem termo específico.',
        }),
      ),
    ]

    expect(summarizeAreaFocus(questions)).toEqual({
      label: null,
      validatedCount: 6,
      totalCount: 10,
    })
  })
})
