import { describe, expect, it } from 'vitest'
import {
  buildTriContext,
  type SimuladoPerformance,
} from './mentor-tri-context'

function makePerf(overrides: Partial<SimuladoPerformance> = {}): SimuladoPerformance {
  const { tri: triOverride, tri_estimado: estimadoOverride, ...rest } = overrides
  return {
    fonte: 'legacy',
    simulado_id: 'sim-1',
    simulado_nome: 'Simulado Teste',
    data: '2026-03-01T00:00:00Z',
    formato: 'enem_180',
    fez_dia1: true,
    fez_dia2: true,
    acertos: { lc: 30, ch: 30, cn: 30, mt: 30 },
    answers: [],
    tri_total: 600,
    ...rest,
    tri: { lc: 600, ch: 600, cn: 600, mt: 600, ...(triOverride ?? {}) },
    tri_estimado: {
      lc: false,
      ch: false,
      cn: false,
      mt: false,
      ...(estimadoOverride ?? {}),
    },
  }
}

describe('buildTriContext', () => {
  it('retorna contexto vazio quando não há performances', () => {
    const ctx = buildTriContext([], [])
    expect(ctx.total_count).toBe(0)
    expect(ctx.estimated_count).toBe(0)
    expect(ctx.last_simulados).toHaveLength(0)
    expect(ctx.fontes_utilizadas).toEqual([])
    expect(ctx.area_trends.lc).toEqual({ current: null, previous: null, delta: null })
    expect(ctx.area_trends.mt).toEqual({ current: null, previous: null, delta: null })
  })

  it('calcula delta positivo quando TRI subiu entre dois simulados', () => {
    const perfs = [
      makePerf({
        simulado_id: 'sim-new',
        data: '2026-03-01T00:00:00Z',
        tri: { lc: 650, ch: 650, cn: 650, mt: 650 },
      }),
      makePerf({
        simulado_id: 'sim-old',
        data: '2026-01-01T00:00:00Z',
        tri: { lc: 600, ch: 600, cn: 600, mt: 600 },
      }),
    ]

    const ctx = buildTriContext(perfs, ['legacy'])
    expect(ctx.area_trends.lc.current).toBe(650)
    expect(ctx.area_trends.lc.previous).toBe(600)
    expect(ctx.area_trends.lc.delta).toBe(50)
    expect(ctx.area_trends.mt.delta).toBe(50)
    expect(ctx.total_count).toBe(2)
    expect(ctx.fontes_utilizadas).toEqual(['legacy'])
  })

  it('ignora scores estimated ao calcular trend (G3 audit guardrail)', () => {
    const perfs = [
      makePerf({
        simulado_id: 'sim-latest-incomplete',
        data: '2026-04-01T00:00:00Z',
        tri: { lc: 320, ch: 650, cn: 320, mt: 650 },
        tri_estimado: { lc: true, ch: false, cn: true, mt: false },
      }),
      makePerf({
        simulado_id: 'sim-complete-old',
        data: '2026-02-01T00:00:00Z',
        tri: { lc: 600, ch: 550, cn: 580, mt: 540 },
      }),
    ]

    const ctx = buildTriContext(perfs, ['legacy'])
    // LC and CN should skip the estimated latest, falling back to older valid scores
    expect(ctx.area_trends.lc.current).toBe(600)
    expect(ctx.area_trends.lc.previous).toBeNull()
    expect(ctx.area_trends.lc.delta).toBeNull()
    expect(ctx.area_trends.cn.current).toBe(580)
    // CH and MT are valid in both, so delta computed normally
    expect(ctx.area_trends.ch.current).toBe(650)
    expect(ctx.area_trends.ch.previous).toBe(550)
    expect(ctx.area_trends.ch.delta).toBe(100)
    expect(ctx.estimated_count).toBe(1)
  })

  it('marca has_estimated no last_simulados quando qualquer área está flagged', () => {
    const perfs = [
      makePerf({
        simulado_id: 'sim-a',
        data: '2026-03-01T00:00:00Z',
        tri_estimado: { lc: false, ch: false, cn: true, mt: false },
      }),
      makePerf({
        simulado_id: 'sim-b',
        data: '2026-02-01T00:00:00Z',
      }),
    ]
    const ctx = buildTriContext(perfs, ['legacy'])
    expect(ctx.last_simulados[0].has_estimated).toBe(true)
    expect(ctx.last_simulados[1].has_estimated).toBe(false)
  })

  it('limita last_simulados a 3 e ordena do mais recente ao mais antigo', () => {
    const perfs = [
      makePerf({ simulado_id: '1', data: '2026-01-01T00:00:00Z' }),
      makePerf({ simulado_id: '2', data: '2026-02-01T00:00:00Z' }),
      makePerf({ simulado_id: '3', data: '2026-03-01T00:00:00Z' }),
      makePerf({ simulado_id: '4', data: '2026-04-01T00:00:00Z' }),
      makePerf({ simulado_id: '5', data: '2026-05-01T00:00:00Z' }),
    ]
    const ctx = buildTriContext(perfs, ['legacy', 'cronogramas'])
    expect(ctx.last_simulados).toHaveLength(3)
    expect(ctx.last_simulados.map((s) => s.simulado_id)).toEqual(['5', '4', '3'])
    expect(ctx.total_count).toBe(5)
  })

  it('retorna delta = null quando só há 1 score válido em uma área', () => {
    const perfs = [
      makePerf({
        simulado_id: 'only-one',
        data: '2026-03-01T00:00:00Z',
      }),
    ]
    const ctx = buildTriContext(perfs, ['legacy'])
    expect(ctx.area_trends.lc.current).toBe(600)
    expect(ctx.area_trends.lc.previous).toBeNull()
    expect(ctx.area_trends.lc.delta).toBeNull()
  })

  it('considera score zero como inválido (não usar em trend)', () => {
    const perfs = [
      makePerf({
        simulado_id: 'new',
        data: '2026-03-01T00:00:00Z',
        tri: { lc: 0, ch: 650, cn: 650, mt: 650 },
      }),
      makePerf({
        simulado_id: 'old',
        data: '2026-01-01T00:00:00Z',
        tri: { lc: 600, ch: 600, cn: 600, mt: 600 },
      }),
    ]
    const ctx = buildTriContext(perfs, ['legacy'])
    // LC: newest has 0 (skipped), falls back to older
    expect(ctx.area_trends.lc.current).toBe(600)
    expect(ctx.area_trends.lc.delta).toBeNull()
    // CH: both valid
    expect(ctx.area_trends.ch.delta).toBe(50)
  })

  it('preserva fontes_utilizadas vindas de get-student-performance', () => {
    const perfs = [makePerf({ simulado_id: '1', data: '2026-03-01T00:00:00Z' })]
    const ctx = buildTriContext(perfs, ['legacy', 'cronogramas'])
    expect(ctx.fontes_utilizadas).toEqual(['legacy', 'cronogramas'])
  })

  it('delta negativo quando TRI caiu (sinal de alerta para mentor)', () => {
    const perfs = [
      makePerf({
        simulado_id: 'recent-drop',
        data: '2026-03-01T00:00:00Z',
        tri: { lc: 500, ch: 500, cn: 500, mt: 500 },
      }),
      makePerf({
        simulado_id: 'better-old',
        data: '2026-01-01T00:00:00Z',
        tri: { lc: 650, ch: 650, cn: 650, mt: 650 },
      }),
    ]
    const ctx = buildTriContext(perfs, ['legacy'])
    expect(ctx.area_trends.lc.delta).toBe(-150)
    expect(ctx.area_trends.mt.delta).toBe(-150)
  })
})
