import { describe, expect, it } from 'vitest'

import type { QuestaoRecomendada } from '../../types/report'
import { buildQuestionImageLayoutKey } from '../../services/question-image-layout'
import {
  buildAreaQuestionRows,
  estimateQuestionCardHeight,
} from './pdf-caderno-layout'

// data URL é aceita sem allowlist de domínio (ver shouldRenderVisualImage)
const DATA_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

function questao(overrides: Partial<QuestaoRecomendada>): QuestaoRecomendada {
  return {
    coItem: 1,
    ano: 2024,
    area: 'LC',
    habilidade: 21,
    matchedTopicLabel: null,
    selectionSource: 'same_skill',
    sourceExam: null,
    sourceExamUsed: null,
    dificuldade: 0.5,
    discriminacao: 1,
    linkImagem: null,
    gabarito: 'A',
    posicaoCaderno: 10,
    enunciado: 'Enunciado curto',
    textoApoio: null,
    alternativas: [
      { letra: 'A', texto: 'alternativa', imagemUrl: null },
      { letra: 'B', texto: 'alternativa', imagemUrl: null },
    ],
    imagemUrl: null,
    requiresVisualContext: false,
    resolutionStatus: 'resolved',
    wasSubstituted: false,
    ...overrides,
  } as QuestaoRecomendada
}

const curta = (coItem: number) => questao({ coItem, posicaoCaderno: coItem })
const longa = (coItem: number) =>
  questao({
    coItem,
    posicaoCaderno: coItem,
    textoApoio: 'x'.repeat(800),
    enunciado: 'y'.repeat(300),
    alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
      letra,
      texto: 'alternativa com texto consideravelmente mais longo do que o normal',
      imagemUrl: null,
    })),
  })

describe('estimateQuestionCardHeight', () => {
  it('questao com mais texto estima mais alta', () => {
    expect(estimateQuestionCardHeight(longa(1), {})).toBeGreaterThan(
      estimateQuestionCardHeight(curta(2), {}) * 2,
    )
  })

  it('imagem valida adiciona altura', () => {
    const semImagem = curta(1)
    const comImagem = questao({
      coItem: 1,
      posicaoCaderno: 1,
      imagemUrl: DATA_IMAGE,
      requiresVisualContext: true,
    })
    expect(estimateQuestionCardHeight(comImagem, {})).toBeGreaterThan(
      estimateQuestionCardHeight(semImagem, {}),
    )
  })
})

describe('buildAreaQuestionRows', () => {
  // Cenário do caderno da Nicole: alternar curta/longa na ordem de chegada
  // gerava pares desbalanceados (coluna da curta ficava em branco)
  it('pareia alturas semelhantes em vez da ordem de chegada', () => {
    const rows = buildAreaQuestionRows(
      [curta(1), longa(2), curta(3), longa(4)],
      {},
    )

    expect(rows).toHaveLength(2)
    // longas juntas, curtas juntas
    expect(rows[0].items.map((q) => q?.coItem)).toEqual([2, 4])
    expect(rows[1].items.map((q) => q?.coItem)).toEqual([1, 3])
  })

  it('linhas vem da mais alta para a mais baixa (curtas aproveitam sobras)', () => {
    const rows = buildAreaQuestionRows(
      [curta(1), curta(2), longa(3), longa(4)],
      {},
    )

    const firstRowHeight = estimateQuestionCardHeight(rows[0].items[0]!, {})
    const lastRowHeight = estimateQuestionCardHeight(rows[rows.length - 1].items[0]!, {})
    expect(firstRowHeight).toBeGreaterThan(lastRowHeight)
  })

  it('quantidade impar deixa a ultima coluna vazia', () => {
    const rows = buildAreaQuestionRows([curta(1), curta(2), curta(3)], {})

    expect(rows).toHaveLength(2)
    expect(rows[1].items[1]).toBeNull()
  })

  it('imagem grande vira linha de largura total', () => {
    const visual = questao({
      coItem: 9,
      posicaoCaderno: 9,
      imagemUrl: DATA_IMAGE,
      requiresVisualContext: true,
    })
    const layouts = {
      [buildQuestionImageLayoutKey(visual)]: { width: 500, height: 300 },
    }

    const rows = buildAreaQuestionRows([curta(1), visual, curta(2)], layouts)

    expect(rows[0]).toMatchObject({ kind: 'full' })
    expect(rows[0].items[0]?.coItem).toBe(9)
    expect(rows[1]).toMatchObject({ kind: 'columns' })
  })
})
