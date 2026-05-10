/**
 * Auditoria anonima dos itens de simulado.
 *
 * A rotina classifica sinais de risco, mas nunca condena item nem autoriza
 * recalculo automatico. Com N baixo, tudo vira fila de revisao defensiva.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { AreaKey } from './tri-engine/reference-tables.ts'

export const SIMULADO_AUDIT_VERSION = '1.0'
export const MIN_STRONG_ITEM_N = 60
export const GABARITO_REVIEW_TOP_ALT_PCT = 0.35

export type ItemAuditClassification =
  | 'confiavel_operacionalmente'
  | 'sinal_revisao_gabarito'
  | 'sinal_revisao_dificuldade'
  | 'sinal_revisao_discriminacao'
  | 'amostra_insuficiente'
  | 'bloqueado_para_recalculo'

export interface AuditItemInput {
  readonly id: string
  readonly simulado_id: string
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade: number
}

export interface AuditResponseInput {
  readonly id: string
  readonly answers: Record<string, string>
  readonly acertos_lc: number
  readonly erros_lc: number
  readonly branco_lc: number
  readonly acertos_ch: number
  readonly erros_ch: number
  readonly branco_ch: number
  readonly acertos_cn: number
  readonly erros_cn: number
  readonly branco_cn: number
  readonly acertos_mt: number
  readonly erros_mt: number
  readonly branco_mt: number
}

export interface ItemAuditResult {
  readonly simulado_id: string
  readonly item_id: string
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade_original: number
  readonly n_respostas: number
  readonly n_respondidas: number
  readonly n_acertos: number
  readonly n_brancos: number
  readonly taxa_acerto: number | null
  readonly erro_padrao_taxa: number | null
  readonly alternativa_mais_marcada: string | null
  readonly alternativa_mais_marcada_pct: number | null
  readonly alternativas: Record<string, number>
  readonly discriminacao_proxy: number | null
  readonly classifications: readonly ItemAuditClassification[]
  readonly review_status: 'sinal_de_revisao'
  readonly recalculo_bloqueado: true
  readonly audit_version: string
}

export interface ResponseIntegrityResult {
  readonly n_respostas: number
  readonly invalid_answers_total: number
  readonly respostas_com_mismatch: number
  readonly mismatch_lc: number
  readonly mismatch_ch: number
  readonly mismatch_cn: number
  readonly mismatch_mt: number
}

const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D', 'E'])

function normalizeAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const v = raw.toUpperCase().trim()
  return VALID_ANSWERS.has(v) ? v : ''
}

function areaAnswered(r: AuditResponseInput, area: AreaKey): number {
  if (area === 'LC') return r.acertos_lc + r.erros_lc
  if (area === 'CH') return r.acertos_ch + r.erros_ch
  if (area === 'CN') return r.acertos_cn + r.erros_cn
  return r.acertos_mt + r.erros_mt
}

function areaCorrect(r: AuditResponseInput, area: AreaKey): number {
  if (area === 'LC') return r.acertos_lc
  if (area === 'CH') return r.acertos_ch
  if (area === 'CN') return r.acertos_cn
  return r.acertos_mt
}

function areaStoredTotals(
  r: AuditResponseInput,
  area: AreaKey,
): { acertos: number; erros: number; branco: number } {
  if (area === 'LC') return { acertos: r.acertos_lc, erros: r.erros_lc, branco: r.branco_lc }
  if (area === 'CH') return { acertos: r.acertos_ch, erros: r.erros_ch, branco: r.branco_ch }
  if (area === 'CN') return { acertos: r.acertos_cn, erros: r.erros_cn, branco: r.branco_cn }
  return { acertos: r.acertos_mt, erros: r.erros_mt, branco: r.branco_mt }
}

function areaOfNumero(numero: number): AreaKey {
  if (numero <= 45) return 'LC'
  if (numero <= 90) return 'CH'
  if (numero <= 135) return 'CN'
  return 'MT'
}

function roundOrNull(v: number | null, digits = 4): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const m = 10 ** digits
  return Math.round(v * m) / m
}

function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

export function computeResponseIntegrity(
  items: readonly AuditItemInput[],
  responses: readonly AuditResponseInput[],
): ResponseIntegrityResult {
  const itemsByArea = new Map<AreaKey, AuditItemInput[]>()
  for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
    itemsByArea.set(area, items.filter((item) => item.area === area))
  }

  let invalidAnswersTotal = 0
  let mismatchLc = 0
  let mismatchCh = 0
  let mismatchCn = 0
  let mismatchMt = 0

  for (const response of responses) {
    const mismatches: Record<AreaKey, boolean> = {
      LC: false,
      CH: false,
      CN: false,
      MT: false,
    }

    for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
      let acertos = 0
      let erros = 0
      let branco = 0
      for (const item of itemsByArea.get(area) ?? []) {
        const raw = response.answers[String(item.numero)]
        if (typeof raw === 'string' && raw.trim() !== '' && !VALID_ANSWERS.has(raw.toUpperCase().trim())) {
          invalidAnswersTotal++
        }
        const ans = normalizeAnswer(raw)
        if (!ans) {
          branco++
        } else if (ans === normalizeAnswer(item.gabarito)) {
          acertos++
        } else {
          erros++
        }
      }
      const stored = areaStoredTotals(response, area)
      mismatches[area] =
        stored.acertos !== acertos || stored.erros !== erros || stored.branco !== branco
    }

    if (mismatches.LC) mismatchLc++
    if (mismatches.CH) mismatchCh++
    if (mismatches.CN) mismatchCn++
    if (mismatches.MT) mismatchMt++
  }

  return {
    n_respostas: responses.length,
    invalid_answers_total: invalidAnswersTotal,
    mismatch_lc: mismatchLc,
    mismatch_ch: mismatchCh,
    mismatch_cn: mismatchCn,
    mismatch_mt: mismatchMt,
    respostas_com_mismatch: responses.filter((response) => {
      for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
        const stored = areaStoredTotals(response, area)
        const areaItems = itemsByArea.get(area) ?? []
        let acertos = 0
        let erros = 0
        let branco = 0
        for (const item of areaItems) {
          const ans = normalizeAnswer(response.answers[String(item.numero)])
          if (!ans) branco++
          else if (ans === normalizeAnswer(item.gabarito)) acertos++
          else erros++
        }
        if (stored.acertos !== acertos || stored.erros !== erros || stored.branco !== branco) {
          return true
        }
      }
      return false
    }).length,
  }
}

export function computeItemAudits(
  items: readonly AuditItemInput[],
  responses: readonly AuditResponseInput[],
): readonly ItemAuditResult[] {
  return items
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((item) => {
      const gabarito = normalizeAnswer(item.gabarito)
      const observedResponses = responses.filter((response) => areaAnswered(response, item.area) > 0)
      const alternativas: Record<string, number> = {}
      let nAcertos = 0
      let nBrancos = 0
      const itemScores: number[] = []
      const areaScoresWithoutItem: number[] = []

      for (const response of observedResponses) {
        const ans = normalizeAnswer(response.answers[String(item.numero)])
        if (!ans) {
          nBrancos++
        } else {
          alternativas[ans] = (alternativas[ans] ?? 0) + 1
        }
        const correct = ans === gabarito ? 1 : 0
        nAcertos += correct
        itemScores.push(correct)
        areaScoresWithoutItem.push(areaCorrect(response, item.area) - correct)
      }

      const nRespostas = observedResponses.length
      const nRespondidas = nRespostas - nBrancos
      const taxaAcerto = nRespostas === 0 ? null : nAcertos / nRespostas
      const erroPadrao =
        taxaAcerto == null || nRespostas === 0
          ? null
          : Math.sqrt((taxaAcerto * (1 - taxaAcerto)) / nRespostas)
      const top = Object.entries(alternativas).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      const alternativaMaisMarcada = top?.[0] ?? null
      const alternativaMaisMarcadaPct =
        top && nRespondidas > 0 ? top[1] / nRespondidas : null
      const discriminacaoProxy = pearson(itemScores, areaScoresWithoutItem)

      const classifications = new Set<ItemAuditClassification>()
      classifications.add('confiavel_operacionalmente')
      classifications.add('bloqueado_para_recalculo')

      if (nRespostas < MIN_STRONG_ITEM_N) {
        classifications.add('amostra_insuficiente')
      }
      if (
        alternativaMaisMarcada != null &&
        alternativaMaisMarcada !== gabarito &&
        (alternativaMaisMarcadaPct ?? 0) >= GABARITO_REVIEW_TOP_ALT_PCT
      ) {
        classifications.add('sinal_revisao_gabarito')
      }
      if (
        (item.dificuldade <= 2 && (taxaAcerto ?? 1) < 0.5) ||
        (item.dificuldade >= 4 && (taxaAcerto ?? 0) > 0.8)
      ) {
        classifications.add('sinal_revisao_dificuldade')
      }
      if (discriminacaoProxy != null && discriminacaoProxy < 0.1) {
        classifications.add('sinal_revisao_discriminacao')
      }

      return {
        simulado_id: item.simulado_id,
        item_id: item.id,
        numero: item.numero,
        area: item.area,
        gabarito,
        dificuldade_original: item.dificuldade,
        n_respostas: nRespostas,
        n_respondidas: nRespondidas,
        n_acertos: nAcertos,
        n_brancos: nBrancos,
        taxa_acerto: roundOrNull(taxaAcerto),
        erro_padrao_taxa: roundOrNull(erroPadrao),
        alternativa_mais_marcada: alternativaMaisMarcada,
        alternativa_mais_marcada_pct: roundOrNull(alternativaMaisMarcadaPct),
        alternativas,
        discriminacao_proxy: roundOrNull(discriminacaoProxy),
        classifications: [...classifications],
        review_status: 'sinal_de_revisao',
        recalculo_bloqueado: true,
        audit_version: SIMULADO_AUDIT_VERSION,
      }
    })
}

export function areasRealizadasFromBreakdown(
  porArea: Record<AreaKey, { readonly acertos: number; readonly erros: number }>,
): AreaKey[] {
  return (['LC', 'CH', 'CN', 'MT'] as const).filter(
    (area) => porArea[area].acertos + porArea[area].erros > 0,
  )
}

export function confidenceFromAreas(
  porArea: Record<AreaKey, { readonly acertos: number; readonly erros: number }>,
): 'high' | 'medium' | 'low' | 'invalid' {
  const realizadas = areasRealizadasFromBreakdown(porArea)
  if (
    realizadas.length === 4 &&
    realizadas.every((area) => porArea[area].acertos + porArea[area].erros >= 40)
  ) {
    return 'high'
  }
  if (realizadas.length >= 2) return 'medium'
  if (realizadas.length === 1) return 'low'
  return 'invalid'
}

export async function runAndPersistItemAudit(
  client: SupabaseClient,
  simuladoId: string,
): Promise<{
  readonly audits: readonly ItemAuditResult[]
  readonly integrity: ResponseIntegrityResult
}> {
  const itensRes = await client
    .from('simulado_itens')
    .select('id, simulado_id, numero, area, gabarito, dificuldade')
    .eq('simulado_id', simuladoId)
    .order('numero', { ascending: true })

  if (itensRes.error) throw new Error(itensRes.error.message)

  const respostasRes = await client
    .from('simulado_respostas')
    .select(
      'id, answers, acertos_lc, erros_lc, branco_lc, acertos_ch, erros_ch, branco_ch, acertos_cn, erros_cn, branco_cn, acertos_mt, erros_mt, branco_mt',
    )
    .eq('simulado_id', simuladoId)

  if (respostasRes.error) throw new Error(respostasRes.error.message)

  const items = (itensRes.data ?? []) as AuditItemInput[]
  const responses = (respostasRes.data ?? []) as AuditResponseInput[]
  const audits = computeItemAudits(items, responses)
  const integrity = computeResponseIntegrity(items, responses)

  if (audits.length > 0) {
    const { error } = await client
      .from('simulado_item_audits')
      .upsert(
        audits.map((audit) => ({
          ...audit,
          classifications: [...audit.classifications],
          audited_at: new Date().toISOString(),
        })),
        { onConflict: 'simulado_id,numero,audit_version' },
      )
    if (error) throw new Error(error.message)
  }

  return { audits, integrity }
}

export function auditSummary(audits: readonly ItemAuditResult[]): Record<ItemAuditClassification, number> {
  const out: Record<ItemAuditClassification, number> = {
    confiavel_operacionalmente: 0,
    sinal_revisao_gabarito: 0,
    sinal_revisao_dificuldade: 0,
    sinal_revisao_discriminacao: 0,
    amostra_insuficiente: 0,
    bloqueado_para_recalculo: 0,
  }
  for (const audit of audits) {
    for (const c of audit.classifications) {
      out[c]++
    }
  }
  return out
}

export { areaOfNumero }
