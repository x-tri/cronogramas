import { describe, expect, it } from 'vitest'

import {
  buildRecommendationKey,
  getDifficultyWindowForTri,
  mergeRecommendationsForStudent,
  pickRecommendationsForStudent,
} from './report-recommendations'

describe('report-recommendations', () => {
  it('deduplica por ano e posicao do caderno antes de limitar', () => {
    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 0.1, posicaoCaderno: 12, coItem: 101 },
        { ano: 2024, dificuldade: 0.2, posicaoCaderno: 12, coItem: 999 },
        { ano: 2023, dificuldade: 0.3, posicaoCaderno: 18, coItem: 202 },
      ],
      600,
      5,
    )

    expect(picked).toHaveLength(2)
    expect(picked.map(buildRecommendationKey)).toEqual(['2023:18', '2024:12'])
  })

  it('prioriza questoes proximas do nivel do aluno', () => {
    const lowTri = pickRecommendationsForStudent(
      [
        { ano: 2022, dificuldade: -1.2, posicaoCaderno: 2, coItem: 1 },
        { ano: 2022, dificuldade: -0.6, posicaoCaderno: 3, coItem: 2 },
        { ano: 2022, dificuldade: 0.8, posicaoCaderno: 4, coItem: 3 },
      ],
      520,
      3,
    )

    const highTri = pickRecommendationsForStudent(
      [
        { ano: 2022, dificuldade: -1.2, posicaoCaderno: 2, coItem: 1 },
        { ano: 2022, dificuldade: 1.4, posicaoCaderno: 3, coItem: 2 },
        { ano: 2022, dificuldade: 2.4, posicaoCaderno: 4, coItem: 3 },
      ],
      760,
      3,
    )

    expect(lowTri.map((item) => item.coItem)).toEqual([2, 1, 3])
    expect(highTri.map((item) => item.coItem)).toEqual([3, 2, 1])
  })

  it('completa com fallback sem perder a selecao personalizada', () => {
    const merged = mergeRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 0.1, posicaoCaderno: 1, coItem: 11 },
        { ano: 2024, dificuldade: 0.2, posicaoCaderno: 2, coItem: 12 },
      ],
      [
        { ano: 2024, dificuldade: 0.2, posicaoCaderno: 2, coItem: 999 },
        { ano: 2023, dificuldade: 0.3, posicaoCaderno: 3, coItem: 13 },
        { ano: 2022, dificuldade: 0.5, posicaoCaderno: 4, coItem: 14 },
      ],
      600,
      4,
    )

    expect(merged.map((item) => item.coItem)).toEqual([12, 11, 14, 13])
  })

  it('limita o quanto o fallback de area domina a lista final', () => {
    const merged = mergeRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 0.1, posicaoCaderno: 1, coItem: 11 },
        { ano: 2024, dificuldade: 0.2, posicaoCaderno: 2, coItem: 12 },
      ],
      [
        { ano: 2023, dificuldade: 0.3, posicaoCaderno: 3, coItem: 13 },
        { ano: 2023, dificuldade: 0.4, posicaoCaderno: 4, coItem: 14 },
        { ano: 2022, dificuldade: 0.5, posicaoCaderno: 5, coItem: 15 },
        { ano: 2022, dificuldade: 0.6, posicaoCaderno: 6, coItem: 16 },
      ],
      600,
      6,
      2,
    )

    expect(merged.map((item) => item.coItem)).toEqual([12, 11, 16, 15])
  })

  it('abre uma faixa mais desafiadora para alunos com TRI alta', () => {
    expect(getDifficultyWindowForTri(520)).toEqual({
      target: 0.2,
      min: -0.7,
      max: 0.6000000000000001,
    })

    expect(getDifficultyWindowForTri(760)).toEqual({
      target: 2.6,
      min: 2.2,
      max: 3.9000000000000004,
    })
  })
})
