import { describe, expect, it } from 'vitest'
import { resolveQuestionTopic } from './question-topic'

describe('resolveQuestionTopic', () => {
  it('prefere o rótulo canônico gerado pelo GLiNER quando disponível', () => {
    expect(
      resolveQuestionTopic(
        {
          questionNumber: 12,
          content: 'Charge (Humor/Trabalho)',
          gliner: {
            model: 'fastino/gliner2-base-v1',
            sourceText: 'Charge (Humor/Trabalho)',
            suggestedLabel: 'História - Trabalho e produção',
            approvedLabel: 'História - Trabalho e produção',
            reviewStatus: 'approved',
          },
        },
        12,
      ),
    ).toBe('História - Trabalho e produção')
  })

  it('não sobrescreve o rótulo original com sugestão pendente', () => {
    expect(
      resolveQuestionTopic(
        {
          questionNumber: 18,
          content: 'Inteligência Artificial - ética',
          gliner: {
            model: 'fastino/gliner2-base-v1',
            sourceText: 'Inteligência Artificial - ética',
            suggestedLabel: 'Física - Termologia',
            reviewStatus: 'pending',
          },
        },
        18,
      ),
    ).toBe('Inteligência Artificial - ética')
  })

  it('usa o conteúdo original quando ainda não existe enriquecimento', () => {
    expect(
      resolveQuestionTopic(
        {
          questionNumber: 22,
          content: 'Inteligência Artificial - ética',
        },
        22,
      ),
    ).toBe('Inteligência Artificial - ética')
  })

  it('recorre ao fallback legado quando a questão não tem conteúdo salvo', () => {
    expect(resolveQuestionTopic(null, 142)).toBe('Q142 - Matemática (Funções e Gráficos)')
  })
})
