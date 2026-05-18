import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReportData } from '../types/report'
import {
  buildQuestionImageLayoutKey,
  calculateQuestionImageLayout,
  DEFAULT_QUESTION_IMAGE_LAYOUT,
  loadQuestionImageLayouts,
} from './question-image-layout'

function buildReportWithQuestionImage(requiresVisualContext: boolean): ReportData {
  return ({
    questoesRecomendadas: {
      habilidadesCriticas: [
        {
          questoesRecomendadas: [
            {
              ano: 2024,
              coItem: 1,
              posicaoCaderno: 1,
              imagemUrl: 'data:image/png;base64,AAA=',
              requiresVisualContext,
            },
          ],
        },
      ],
    },
  } as unknown) as ReportData
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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
      width: 440,
      height: 247,
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

  it('carrega layout para qualquer questao com imagem, mesmo sem flag visual', async () => {
    vi.stubGlobal('Image', class {
      crossOrigin = ''
      decoding = 'async'
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    })

    const layouts = await loadQuestionImageLayouts(buildReportWithQuestionImage(false))

    expect(layouts['2024:1:1']).toEqual(DEFAULT_QUESTION_IMAGE_LAYOUT)
  })
})
