import { describe, expect, it } from 'vitest'

import {
  auditPdfRecommendationQuality,
  buildRecommendationKey,
  filterPdfSafeRecommendations,
  getDifficultyWindowForTri,
  mergeRecommendationsForStudent,
  normalizeIrtParam,
  pickRecommendationsForStudent,
} from './report-recommendations'

describe('normalizeIrtParam', () => {
  // ~4% dos itens INEP têm escala x100 por erro de importação
  // (1.06685 importado como 106.685). Detectado em 2026-06-11.
  it('corrige parâmetros importados com fator x100', () => {
    expect(normalizeIrtParam(106.685)).toBeCloseTo(1.06685)
    expect(normalizeIrtParam(221.619)).toBeCloseTo(2.21619)
    expect(normalizeIrtParam(-180.5)).toBeCloseTo(-1.805)
  })

  it('mantém parâmetros na escala IRT normal', () => {
    expect(normalizeIrtParam(0.36753)).toBe(0.36753)
    expect(normalizeIrtParam(-2.4)).toBe(-2.4)
    expect(normalizeIrtParam(3.9)).toBe(3.9)
  })

  it('nulo/indefinido/NaN viram 0', () => {
    expect(normalizeIrtParam(null)).toBe(0)
    expect(normalizeIrtParam(undefined)).toBe(0)
    expect(normalizeIrtParam(Number.NaN)).toBe(0)
  })
})

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

  it('em dificuldade equivalente, prefere a questao mais discriminativa (param_a)', () => {
    // Itens praticamente no mesmo nível (mesma faixa de 0.1 de distância do
    // alvo): o de maior discriminação informa mais sobre o aluno (a²·P·Q).
    // TRI 600 = faixa balanceada, sem viés de lado interferindo.
    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 1.02, posicaoCaderno: 10, coItem: 1, discriminacao: 0.8 },
        { ano: 2023, dificuldade: 1.04, posicaoCaderno: 11, coItem: 2, discriminacao: 2.1 },
        { ano: 2022, dificuldade: 0.98, posicaoCaderno: 12, coItem: 3, discriminacao: 1.4 },
      ],
      600, // alvo b = 1.0
      3,
    )

    expect(picked.map((item) => item.coItem)).toEqual([2, 3, 1])
  })

  it('discriminacao nao passa na frente de proximidade do nivel', () => {
    const picked = pickRecommendationsForStudent(
      [
        // longe do alvo (b=0.4) mas muito discriminativa
        { ano: 2024, dificuldade: 1.2, posicaoCaderno: 10, coItem: 1, discriminacao: 2.5 },
        // no alvo, discriminação baixa
        { ano: 2023, dificuldade: 0.4, posicaoCaderno: 11, coItem: 2, discriminacao: 0.5 },
      ],
      540,
      2,
    )

    expect(picked.map((item) => item.coItem)).toEqual([2, 1])
  })

  it('itens sem discriminacao continuam ordenando como antes', () => {
    const picked = pickRecommendationsForStudent(
      [
        { ano: 2022, dificuldade: 0.9, posicaoCaderno: 2, coItem: 1 },
        { ano: 2022, dificuldade: 0.4, posicaoCaderno: 3, coItem: 2 },
      ],
      540,
      2,
    )

    expect(picked.map((item) => item.coItem)).toEqual([2, 1])
  })

  it('despriotiza questoes ja entregues em cadernos anteriores', () => {
    // A questão já entregue (2024:10) está MAIS perto do alvo, mas o aluno
    // já a recebeu — questões inéditas vêm primeiro
    const delivered = new Set(['2024:10'])

    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 1.0, posicaoCaderno: 10, coItem: 1 },
        { ano: 2023, dificuldade: 1.3, posicaoCaderno: 11, coItem: 2 },
        { ano: 2022, dificuldade: 0.6, posicaoCaderno: 12, coItem: 3 },
      ],
      600,
      2,
      delivered,
    )

    expect(picked.map((item) => item.coItem)).toEqual([2, 3])
  })

  it('salvaguarda: entregues completam o caderno quando faltam ineditas', () => {
    const delivered = new Set(['2024:10', '2023:11'])

    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 1.0, posicaoCaderno: 10, coItem: 1 },
        { ano: 2023, dificuldade: 1.1, posicaoCaderno: 11, coItem: 2 },
        { ano: 2022, dificuldade: 0.9, posicaoCaderno: 12, coItem: 3 },
      ],
      600,
      3,
      delivered,
    )

    // A inédita primeiro; as entregues completam (mais próxima do alvo antes)
    expect(picked.map((item) => item.coItem)).toEqual([3, 1, 2])
  })

  it('merge tambem respeita as entregues', () => {
    const delivered = new Set(['2024:10'])

    const merged = mergeRecommendationsForStudent(
      [{ ano: 2024, dificuldade: 1.0, posicaoCaderno: 10, coItem: 1 }],
      [{ ano: 2022, dificuldade: 1.0, posicaoCaderno: 20, coItem: 2 }],
      600,
      1,
      1,
      delivered,
    )

    expect(merged.map((item) => item.coItem)).toEqual([2])
  })

  it('prioriza questoes com imagem quando estao na faixa adequada do aluno', () => {
    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 0.1, posicaoCaderno: 10, coItem: 10 },
        {
          ano: 2024,
          dificuldade: 0.2,
          posicaoCaderno: 11,
          coItem: 11,
          imagemUrl: 'https://api.questoes.xtri.online/media/enem/2024/questions/136/question-136.png',
        },
        { ano: 2024, dificuldade: 0.3, posicaoCaderno: 12, coItem: 12 },
      ],
      520,
      3,
    )

    expect(picked.map((item) => item.coItem)).toEqual([11, 10, 12])
  })

  it('prioriza questoes com imagem nas alternativas', () => {
    const picked = pickRecommendationsForStudent(
      [
        { ano: 2024, dificuldade: 0.1, posicaoCaderno: 10, coItem: 10 },
        {
          ano: 2020,
          dificuldade: 0.2,
          posicaoCaderno: 157,
          coItem: 157,
          alternativas: [{ imagemUrl: 'https://api.questoes.xtri.online/media/enem/2020/questions/157/a.png' }],
        },
      ],
      520,
      2,
    )

    expect(picked.map((item) => item.coItem)).toEqual([157, 10])
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

  it('bloqueia questão visual sem imagem antes de montar PDF', () => {
    const findings = auditPdfRecommendationQuality({
      ano: 2024,
      dificuldade: 0.2,
      posicaoCaderno: 136,
      coItem: 136,
      enunciado: 'Observe a figura e responda.',
      requiresVisualContext: true,
      imagemUrl: null,
      alternativas: [
        { letra: 'A', texto: 'alternativa a', imagemUrl: null },
        { letra: 'B', texto: 'alternativa b', imagemUrl: null },
      ],
    })

    expect(findings.map((finding) => finding.issue)).toContain(
      'visual_context_without_image',
    )
  })

  it('mantém alternativas-imagem quando a API fornece URL da imagem', () => {
    const safe = filterPdfSafeRecommendations([
      {
        ano: 2020,
        dificuldade: 0.2,
        posicaoCaderno: 157,
        coItem: 157,
        enunciado: 'Escolha a representação correta.',
        requiresVisualContext: false,
        alternativas: [
          {
            letra: 'A',
            texto: '',
            imagemUrl: 'https://api.questoes.xtri.online/media/enem/2020/questions/157/a.png',
          },
        ],
      },
    ])

    expect(safe).toHaveLength(1)
  })

  it('remove alternativa vazia sem imagem do conjunto seguro para PDF', () => {
    const safe = filterPdfSafeRecommendations([
      {
        ano: 2020,
        dificuldade: 0.2,
        posicaoCaderno: 161,
        coItem: 161,
        enunciado: 'Escolha a alternativa correta.',
        requiresVisualContext: false,
        alternativas: [{ letra: 'A', texto: '', imagemUrl: null }],
      },
    ])

    expect(safe).toHaveLength(0)
  })

  it('bloqueia ENEM 2024 Q156 quando a API entrega alternativa quebrada', () => {
    const safe = filterPdfSafeRecommendations([
      {
        ano: 2024,
        dificuldade: 0.91,
        posicaoCaderno: 156,
        coItem: 156,
        enunciado: 'Nessas condições, a expressão que fornece o valor V a ser pago é',
        requiresVisualContext: false,
        alternativas: [
          { letra: 'A', texto: '2,00 F + 0,26 T + 1,40', imagemUrl: null },
          { letra: 'B', texto: '2,00 + 0,26 T + 1,40', imagemUrl: null },
          { letra: 'C', texto: '2,00 + 0,26 T +', imagemUrl: null },
          { letra: 'D', texto: '', imagemUrl: null },
          { letra: 'E', texto: 'F', imagemUrl: null },
        ],
      },
    ])

    expect(safe).toHaveLength(0)
  })

  it('mantém ENEM 2020 Q170 quando alternativas vêm como imagens da API', () => {
    const safe = filterPdfSafeRecommendations([
      {
        ano: 2020,
        dificuldade: 1.21,
        posicaoCaderno: 170,
        coItem: 170,
        enunciado: 'A fração do capital de cada sócio que Antônio deverá adquirir é',
        requiresVisualContext: false,
        alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
          letra,
          texto: '',
          imagemUrl: `https://api.questoes.xtri.online/media/enem/2020/questions/170/${letra}.png`,
        })),
      },
    ])

    expect(safe).toHaveLength(1)
  })

  it('bloqueia item que menciona imagem sem URL de imagem', () => {
    const findings = auditPdfRecommendationQuality({
      ano: 2019,
      dificuldade: -0.25,
      posicaoCaderno: 59,
      coItem: 59,
      enunciado: 'A divisão política do mundo como apresentada na imagem seria',
      requiresVisualContext: false,
      alternativas: [
        { letra: 'A', texto: 'opção a', imagemUrl: null },
        { letra: 'B', texto: 'opção b', imagemUrl: null },
        { letra: 'C', texto: 'opção c', imagemUrl: null },
        { letra: 'D', texto: 'opção d', imagemUrl: null },
        { letra: 'E', texto: 'opção e', imagemUrl: null },
      ],
    })

    expect(findings.map((finding) => finding.issue)).toContain(
      'visual_context_without_image',
    )
  })
})
