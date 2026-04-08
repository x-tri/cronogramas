import { describe, expect, it } from 'vitest'

import {
  derivePedagogicalFocusForSkill,
  extractTopicSearchTerms,
  isSyntheticTopicLabel,
  scoreTopicTextRelevance,
} from './report-topic-focus'

describe('report-topic-focus', () => {
  it('usa o tópico real da questão quando disponível', () => {
    const focus = derivePedagogicalFocusForSkill({
      erro: {
        area: 'CH',
        numeroHabilidade: 15,
        identificador: 'CH-H15',
        descricao: 'descrição',
        questoesErradas: [46, 47, 48],
        totalErros: 3,
      },
      wrongQuestions: [
        {
          examId: 'exam-1',
          questionNumber: 46,
          topic: 'Era Vargas',
          studentAnswer: 'A',
          correctAnswer: 'B',
        },
        {
          examId: 'exam-1',
          questionNumber: 47,
          topic: 'Era Vargas',
          studentAnswer: 'A',
          correctAnswer: 'B',
        },
        {
          examId: 'exam-1',
          questionNumber: 48,
          topic: 'República Oligárquica',
          studentAnswer: 'A',
          correctAnswer: 'B',
        },
      ],
      fallbackLabel: 'Conflitos ao Longo da História',
    })

    expect(focus).toEqual({
      label: 'Era Vargas',
      source: 'question_topic',
    })
  })

  it('cai no mapa de habilidade quando o tópico é sintético', () => {
    const focus = derivePedagogicalFocusForSkill({
      erro: {
        area: 'MT',
        numeroHabilidade: 19,
        identificador: 'MT-H19',
        descricao: 'descrição',
        questoesErradas: [141],
        totalErros: 1,
      },
      wrongQuestions: [
        {
          examId: 'exam-1',
          questionNumber: 141,
          topic: 'Q141 - Matemática (Funções e Gráficos)',
          studentAnswer: 'A',
          correctAnswer: 'B',
        },
      ],
      fallbackLabel: 'Expressões Algébricas',
    })

    expect(focus).toEqual({
      label: 'Expressões Algébricas',
      source: 'skill_map',
    })
  })

  it('extrai termos relevantes do tópico real', () => {
    expect(extractTopicSearchTerms('Era Vargas')).toEqual(['vargas'])
    expect(extractTopicSearchTerms('Problemas com Números')).toEqual([])
  })

  it('reconhece rótulo sintético vindo do fallback por número', () => {
    expect(isSyntheticTopicLabel('Q112 - Química (Geral)')).toBe(true)
    expect(isSyntheticTopicLabel('Citologia')).toBe(false)
  })

  it('pontua mais alto quando o texto menciona o tópico', () => {
    const score = scoreTopicTextRelevance('Era Vargas', {
      stem: 'A Era Vargas redefiniu as relações de trabalho no Brasil.',
      supportText: null,
      imageAlt: null,
    })

    const scoreWithoutMatch = scoreTopicTextRelevance('Citologia', {
      stem: 'O gráfico mostra a variação da temperatura.',
      supportText: null,
      imageAlt: null,
    })

    expect(score).toBeGreaterThan(0)
    expect(scoreWithoutMatch).toBe(0)
  })
})
