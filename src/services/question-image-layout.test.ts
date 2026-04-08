import { describe, expect, it } from 'vitest'
import {
  buildQuestionImageLayoutKey,
  calculateQuestionImageLayout,
} from './question-image-layout'

describe('question-image-layout', () => {
  it('mantem imagem pequena no tamanho natural sem ampliar raster', () => {
    const layout = calculateQuestionImageLayout({
      naturalWidthPx: 240,
      naturalHeightPx: 120,
    })

    expect(layout).toEqual({
      width: 180,
      height: 90,
    })
  })

  it('reduz imagem grande para caber no PDF sem distorcer', () => {
    const layout = calculateQuestionImageLayout({
      naturalWidthPx: 1600,
      naturalHeightPx: 900,
    })

    expect(layout).toEqual({
      width: 500,
      height: 281,
    })
  })

  it('usa fallback seguro quando nao conhece as dimensoes', () => {
    const layout = calculateQuestionImageLayout(null)

    expect(layout).toEqual({
      width: 260,
      height: 160,
    })
  })

  it('gera chave estavel por questao', () => {
    expect(
      buildQuestionImageLayoutKey({
        ano: 2024,
        coItem: 5,
        posicaoCaderno: 5,
      }),
    ).toBe('2024:5:5')
  })
})
