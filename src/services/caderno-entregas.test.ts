import { describe, expect, it } from 'vitest'

import { buildCadernoQuestaoRows } from './caderno-entregas'

describe('buildCadernoQuestaoRows', () => {
  it('mapeia questões para linhas com a mesma chave do dedupe do motor', () => {
    const rows = buildCadernoQuestaoRows({
      pdfHistoryId: 'pdf-1',
      schoolId: 'escola-1',
      alunoId: '001-008626',
      matricula: '001-008626',
      questoes: [
        { ano: 2024, posicaoCaderno: 4, coItem: 111, area: 'LC', habilidade: 21 },
        { ano: 2023, posicaoCaderno: null, coItem: 222, area: 'CH', habilidade: null },
      ],
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      question_key: '2024:4',
      ano: 2024,
      posicao: 4,
      co_item: 111,
      area: 'LC',
      habilidade: 21,
      pdf_history_id: 'pdf-1',
      school_id: 'escola-1',
    })
    // sem posição no caderno, a chave cai no co_item (igual ao dedupe)
    expect(rows[1].question_key).toBe('2023:222')
  })

  it('deduplica questões repetidas entre habilidades da mesma área', () => {
    const rows = buildCadernoQuestaoRows({
      pdfHistoryId: null,
      schoolId: null,
      alunoId: 'a',
      matricula: null,
      questoes: [
        { ano: 2024, posicaoCaderno: 4, coItem: 111, area: 'LC' },
        { ano: 2024, posicaoCaderno: 4, coItem: 111, area: 'LC' },
      ],
    })

    expect(rows).toHaveLength(1)
  })

  it('lista vazia gera zero linhas', () => {
    expect(
      buildCadernoQuestaoRows({
        pdfHistoryId: null,
        schoolId: null,
        alunoId: 'a',
        matricula: null,
        questoes: [],
      }),
    ).toEqual([])
  })
})
