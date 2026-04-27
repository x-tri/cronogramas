/**
 * Recalcula uma simulado_respostas in-place usando a engine TRI atual.
 *
 * Use case: quando a tabela de referencia TRI muda (ex: v1.1 com n=45 LC),
 * as respostas ja gravadas mantem os valores antigos. Esse helper recalcula
 * tri_*, acertos/erros/branco_*, erros_por_topico (formato novo {area, n})
 * e erros_por_habilidade preservando answers, submitted_at, simulado_id e
 * student_id.
 *
 * NOTE: requer service_role para bypassar RLS de simulado_respostas (que so
 * permite INSERT via Edge Function em producao).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  calcAllTRI,
  calcTotals,
  groupErrorsBy,
  groupErrorsByWithArea,
  type ErrosPorTopicoComArea,
  type TriResults,
} from './tri-engine/engine.ts'
import { type AreaKey } from './tri-engine/reference-tables.ts'
import { answersMapToArray } from './submit-simulado.ts'

const TOTAL_ITEMS = 180

interface SimuladoItemRow {
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade: number
  readonly topico: string | null
  readonly habilidade: string | null
}

interface RespostaRow {
  readonly id: string
  readonly simulado_id: string
  readonly student_id: string
  readonly answers: Record<string, string>
  // Snapshot dos valores anteriores (para report de diff)
  readonly tri_lc: number | null
  readonly tri_ch: number | null
  readonly tri_cn: number | null
  readonly tri_mt: number | null
}

export interface RecomputeDiff {
  readonly resposta_id: string
  readonly simulado_id: string
  readonly student_id: string
  readonly tri_antes: Record<AreaKey, number | null>
  readonly tri_depois: Record<AreaKey, number | null>
  readonly delta: Record<AreaKey, number | null>
}

export interface RecomputeError {
  readonly resposta_id: string
  readonly kind: 'fetch_resposta' | 'fetch_itens' | 'itens_invalidos' | 'update_failed'
  readonly message: string
}

function scoreOf(results: TriResults, area: AreaKey): number | null {
  const r = results[area]
  return r ? Math.round(r.score * 10) / 10 : null
}

function computeAreaBreakdown(
  answers: readonly string[],
  gabarito: readonly string[],
): Record<AreaKey, { acertos: number; erros: number; branco: number }> {
  const out: Record<AreaKey, { acertos: number; erros: number; branco: number }> = {
    LC: { acertos: 0, erros: 0, branco: 0 },
    CH: { acertos: 0, erros: 0, branco: 0 },
    CN: { acertos: 0, erros: 0, branco: 0 },
    MT: { acertos: 0, erros: 0, branco: 0 },
  }
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const area: AreaKey =
      i < 45 ? 'LC' : i < 90 ? 'CH' : i < 135 ? 'CN' : 'MT'
    const ans = (answers[i] ?? '').toUpperCase().trim()
    const correct = (gabarito[i] ?? '').toUpperCase().trim()
    if (!ans) {
      out[area].branco += 1
    } else if (ans === correct) {
      out[area].acertos += 1
    } else {
      out[area].erros += 1
    }
  }
  return out
}

export async function recomputeSimuladoResposta(
  client: SupabaseClient,
  respostaId: string,
): Promise<{ ok: true; diff: RecomputeDiff } | { ok: false; error: RecomputeError }> {
  // 1. Busca resposta
  const respRes = await client
    .from('simulado_respostas')
    .select('id, simulado_id, student_id, answers, tri_lc, tri_ch, tri_cn, tri_mt')
    .eq('id', respostaId)
    .maybeSingle<RespostaRow>()

  if (respRes.error) {
    return { ok: false, error: { resposta_id: respostaId, kind: 'fetch_resposta', message: respRes.error.message } }
  }
  if (!respRes.data) {
    return { ok: false, error: { resposta_id: respostaId, kind: 'fetch_resposta', message: 'resposta nao encontrada' } }
  }

  const resp = respRes.data

  // 2. Busca itens do simulado (para gabarito + dificuldade + topico + area)
  const itensRes = await client
    .from('simulado_itens')
    .select('numero, area, gabarito, dificuldade, topico, habilidade')
    .eq('simulado_id', resp.simulado_id)
    .order('numero', { ascending: true })

  if (itensRes.error) {
    return { ok: false, error: { resposta_id: respostaId, kind: 'fetch_itens', message: itensRes.error.message } }
  }
  const itens = (itensRes.data ?? []) as SimuladoItemRow[]
  if (itens.length !== TOTAL_ITEMS) {
    return { ok: false, error: { resposta_id: respostaId, kind: 'itens_invalidos', message: `esperado ${TOTAL_ITEMS} itens, encontrado ${itens.length}` } }
  }

  // 3. Monta arrays na ordem do numero (1..180 = idx 0..179)
  const gabarito: string[] = new Array(TOTAL_ITEMS).fill('')
  const difficulties: number[] = new Array(TOTAL_ITEMS).fill(3)
  const topicos: (string | null)[] = new Array(TOTAL_ITEMS).fill(null)
  const habilidades: (string | null)[] = new Array(TOTAL_ITEMS).fill(null)
  const areas: (AreaKey | null)[] = new Array(TOTAL_ITEMS).fill(null)

  for (const item of itens) {
    const idx = item.numero - 1
    if (idx < 0 || idx >= TOTAL_ITEMS) continue
    gabarito[idx] = item.gabarito
    difficulties[idx] = item.dificuldade
    topicos[idx] = item.topico
    habilidades[idx] = item.habilidade
    areas[idx] = item.area
  }

  const answersArray = answersMapToArray(resp.answers)

  // 4. Recalcula TRI + breakdown + erros (formato novo {area, n})
  const tri = calcAllTRI(answersArray, { gabarito, difficulties })
  const totaisArea = computeAreaBreakdown(answersArray, gabarito)
  const errosPorTopico: Record<string, ErrosPorTopicoComArea> =
    groupErrorsByWithArea(answersArray, gabarito, topicos, areas)
  const errosPorHabilidade = groupErrorsBy(answersArray, gabarito, habilidades)

  const triDepois: Record<AreaKey, number | null> = {
    LC: scoreOf(tri, 'LC'),
    CH: scoreOf(tri, 'CH'),
    CN: scoreOf(tri, 'CN'),
    MT: scoreOf(tri, 'MT'),
  }

  // 5. UPDATE in-place (preserva id, simulado_id, student_id, answers, submitted_at)
  const upd = await client
    .from('simulado_respostas')
    .update({
      tri_lc: triDepois.LC,
      tri_ch: triDepois.CH,
      tri_cn: triDepois.CN,
      tri_mt: triDepois.MT,
      acertos_lc: totaisArea.LC.acertos, erros_lc: totaisArea.LC.erros, branco_lc: totaisArea.LC.branco,
      acertos_ch: totaisArea.CH.acertos, erros_ch: totaisArea.CH.erros, branco_ch: totaisArea.CH.branco,
      acertos_cn: totaisArea.CN.acertos, erros_cn: totaisArea.CN.erros, branco_cn: totaisArea.CN.branco,
      acertos_mt: totaisArea.MT.acertos, erros_mt: totaisArea.MT.erros, branco_mt: totaisArea.MT.branco,
      erros_por_topico: errosPorTopico,
      erros_por_habilidade: errosPorHabilidade,
    })
    .eq('id', respostaId)

  if (upd.error) {
    return { ok: false, error: { resposta_id: respostaId, kind: 'update_failed', message: upd.error.message } }
  }

  const triAntes: Record<AreaKey, number | null> = {
    LC: resp.tri_lc, CH: resp.tri_ch, CN: resp.tri_cn, MT: resp.tri_mt,
  }
  const delta: Record<AreaKey, number | null> = {
    LC: triDepois.LC != null && triAntes.LC != null ? Math.round((triDepois.LC - triAntes.LC) * 10) / 10 : null,
    CH: triDepois.CH != null && triAntes.CH != null ? Math.round((triDepois.CH - triAntes.CH) * 10) / 10 : null,
    CN: triDepois.CN != null && triAntes.CN != null ? Math.round((triDepois.CN - triAntes.CN) * 10) / 10 : null,
    MT: triDepois.MT != null && triAntes.MT != null ? Math.round((triDepois.MT - triAntes.MT) * 10) / 10 : null,
  }

  return {
    ok: true,
    diff: {
      resposta_id: respostaId,
      simulado_id: resp.simulado_id,
      student_id: resp.student_id,
      tri_antes: triAntes,
      tri_depois: triDepois,
      delta,
    },
  }
}
