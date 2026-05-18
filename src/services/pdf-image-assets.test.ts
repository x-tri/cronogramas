import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReportData } from '../types/report'
import {
  buildQuestionImageProxyUrl,
  embedQuestionPdfImages,
} from './pdf-image-assets'

function buildMinimalReport(imageUrl: string): ReportData {
  return ({
    questoesRecomendadas: {
      habilidadesCriticas: [
        {
          area: 'MT',
          numeroHabilidade: 1,
          identificador: 'MT_H1',
          pedagogicalLabel: 'habilidade',
          pedagogicalLabelSource: 'skill_map',
          totalErros: 1,
          percentualIncidencia: 100,
          score: 1,
          questoesRecomendadas: [
            {
              coItem: 170,
              ano: 2020,
              area: 'MT',
              habilidade: 1,
              matchedTopicLabel: null,
              selectionSource: 'same_skill',
              sourceExam: 'ENEM 2020',
              sourceExamUsed: 'ENEM 2020',
              dificuldade: 1.21,
              discriminacao: 0,
              linkImagem: null,
              gabarito: 'C',
              posicaoCaderno: 170,
              enunciado: 'A fração do capital de cada sócio que Antônio deverá adquirir é',
              textoApoio: null,
              alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
                letra,
                texto: '',
                imagemUrl: imageUrl,
              })),
              imagemUrl: null,
              requiresVisualContext: false,
              resolutionStatus: 'resolved',
              wasSubstituted: false,
            },
          ],
        },
      ],
    },
  } as unknown) as ReportData
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pdf-image-assets', () => {
  it('monta proxy somente para imagens permitidas da API de questões', () => {
    const url =
      'https://api.questoes.xtri.online/media/enem/2020/questions/170/a.png'

    expect(buildQuestionImageProxyUrl(url)).toContain(
      '/question-image-proxy.php?url=',
    )
    expect(buildQuestionImageProxyUrl('https://example.com/a.png')).toBeNull()
  })

  it('converte imagens de alternativas para data URL antes do PDF', async () => {
    const imageUrl =
      'https://api.questoes.xtri.online/media/enem/2020/questions/170/a.png'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    const report = await embedQuestionPdfImages(buildMinimalReport(imageUrl))
    const question =
      report.questoesRecomendadas.habilidadesCriticas[0]?.questoesRecomendadas[0]

    expect(question?.alternativas?.[0]?.imagemUrl).toMatch(
      /^data:image\/png;base64,/,
    )
    expect(question?.alternativas).toHaveLength(5)
  })
})
