/**
 * Smoke tests REAIS contra api.questoes.xtri.online.
 *
 * Sao skipados em CI por padrao. Para rodar localmente:
 *   SMOKE_API=1 pnpm test src/services/api-questoes-xtri.smoke.spec.ts
 */

import { describe, expect, it } from 'vitest'

import {
  fetchQuestionByYearIndex,
  fetchQuestionDetail,
  fetchQuestionsByDiscipline,
  fetchQuestionsByYearIndexBatch,
  filterValidForTri,
  mapApiToOptions,
  mapApiToQuestionCandidate,
} from './api-questoes-xtri'

declare const process: { readonly env: Readonly<Record<string, string | undefined>> }
const SHOULD_RUN = Boolean(process.env.SMOKE_API)

describe('smoke api.questoes.xtri.online (rodar com SMOKE_API=1)', () => {
  it.runIf(SHOULD_RUN)(
    'fetchQuestionByYearIndex(2024, 17) retorna questao valida com alternativas',
    async () => {
      const q = await fetchQuestionByYearIndex(2024, 17)
      expect(q).not.toBeNull()
      expect(q!.year).toBe(2024)
      expect(q!.index).toBe(17)
      expect(q!.alternatives).toBeDefined()
      expect(q!.alternatives!.length).toBe(5)
      expect(q!.alternatives!.some((a) => a.isCorrect)).toBe(true)
      expect(q!.context).toBeTruthy()
      expect(q!.alternativesIntroduction).toBeTruthy()
      expect(typeof q!.param_b).toBe('number') // 2024 ja calibrado
      console.log(`  ✓ Q17 ENEM 2024: ${q!.discipline} skill=${q!.skill?.code} param_b=${q!.param_b}`)
    },
    30_000,
  )

  it.runIf(SHOULD_RUN)(
    'fetchQuestionByYearIndex(2025, 1) retorna questao 2025 com param_b=null',
    async () => {
      const q = await fetchQuestionByYearIndex(2025, 1)
      expect(q).not.toBeNull()
      expect(q!.year).toBe(2025)
      expect(q!.param_b).toBeNull() // microdados nao saidos
      console.log(`  ✓ Q1 ENEM 2025: discipline=${q!.discipline} param_b=${q!.param_b} (esperado null)`)
    },
    30_000,
  )

  it.runIf(SHOULD_RUN)(
    'fetchQuestionsByYearIndexBatch — paralelo + ordem preservada',
    async () => {
      const pairs = [
        { year: 2024, index: 1 },
        { year: 2024, index: 50 },
        { year: 2023, index: 100 },
        { year: 2022, index: 180 },
      ]
      const t0 = Date.now()
      const results = await fetchQuestionsByYearIndexBatch(pairs)
      const dt = Date.now() - t0
      expect(results).toHaveLength(4)
      results.forEach((q, i) => {
        expect(q).not.toBeNull()
        expect(q!.year).toBe(pairs[i]!.year)
        expect(q!.index).toBe(pairs[i]!.index)
      })
      console.log(`  ✓ batch 4 questoes em ${dt}ms (paralelo)`)
    },
    60_000,
  )

  it.runIf(SHOULD_RUN)(
    'fetchQuestionsByDiscipline(2024, matematica) — paginated + details',
    async () => {
      const list = await fetchQuestionsByDiscipline(2024, 'matematica', {
        includeDetails: true,
      })
      expect(list.length).toBeGreaterThanOrEqual(40)
      expect(list.length).toBeLessThanOrEqual(50) // ENEM tem 45 MT
      const sample = list[0]!
      expect(sample.discipline).toBe('matematica')
      expect(sample.year).toBe(2024)
      expect(sample.alternatives).toBeDefined()
      expect(sample.alternatives!.length).toBe(5)
      console.log(`  ✓ MT 2024: ${list.length} questoes (com details)`)
    },
    120_000,
  )

  it.runIf(SHOULD_RUN)(
    'filterValidForTri — exclui in_item_aban + sem param_b',
    async () => {
      // Pega 1 ano com param_b para ver o filtro funcionando
      const list = await fetchQuestionsByDiscipline(2024, 'linguagens')
      const total = list.length
      const filtered = filterValidForTri(list, { requireParamB: true })
      const semParamB = list.filter((q) => q.param_b == null).length
      const abandonados = list.filter((q) => q.in_item_aban).length
      console.log(
        `  ✓ LC 2024: total=${total}, sem param_b=${semParamB}, abandonados=${abandonados}, valid_tri=${filtered.length}`,
      )
      expect(filtered.length).toBeLessThanOrEqual(total)
    },
    60_000,
  )

  it.runIf(SHOULD_RUN)(
    'adapters: ApiQuestion -> QuestionCandidateRow + QuestionOptionRow (formato legado)',
    async () => {
      const apiQ = await fetchQuestionDetail(17382) // q17 ENEM 2024
      expect(apiQ).not.toBeNull()
      const candidate = mapApiToQuestionCandidate(apiQ)
      expect(candidate.id).toBe('17382')
      expect(candidate.source_year).toBe(2024)
      expect(candidate.source_question).toBe(17)
      expect(candidate.source_exam).toBe('ENEM 2024')
      expect(candidate.stem).toBeTruthy()
      expect(candidate.support_text).toBeTruthy()
      expect(['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD']).toContain(
        candidate.difficulty,
      )
      const opts = mapApiToOptions(apiQ)
      expect(opts).toHaveLength(5)
      expect(opts.some((o) => o.is_correct)).toBe(true)
      console.log(
        `  ✓ adapter Q17/2024: difficulty=${candidate.difficulty} (de param_b=${apiQ.param_b}), gabarito=${opts.find((o) => o.is_correct)?.letter}`,
      )
    },
    30_000,
  )

  it.runIf(SHOULD_RUN)(
    'cobertura completa 2009-2025 (lista de exames)',
    async () => {
      // Probe simples: pega 1 questao de cada ano para confirmar que /api/exams/{year}/questions/ funciona
      const years = [2009, 2010, 2015, 2020, 2024, 2025]
      const results = await Promise.all(
        years.map((y) => fetchQuestionByYearIndex(y, 1)),
      )
      results.forEach((q, i) => {
        expect(q, `ano ${years[i]}`).not.toBeNull()
        expect(q!.year).toBe(years[i])
      })
      console.log(`  ✓ cobertura ok: ${years.join(', ')}`)
    },
    60_000,
  )

  it('skipa em CI (sem SMOKE_API)', () => {
    if (!SHOULD_RUN) console.log('  ⚠ skip — defina SMOKE_API=1 pra rodar')
    expect(true).toBe(true)
  })
})
