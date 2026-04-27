/**
 * Script de recalculo TRI em massa, rodavel via vitest.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
 *     pnpm test scripts/recalc-respostas.spec.ts
 *
 * Sem SUPABASE_SERVICE_ROLE_KEY, o teste e SKIPADO (nao quebra CI).
 *
 * Ele:
 *   1. Lista TODAS as simulado_respostas em prod
 *   2. Para cada uma, chama recomputeSimuladoResposta (recalcula tri_*,
 *      acertos/erros/branco, erros_por_topico no formato novo)
 *   3. Imprime tabela de diff (antes -> depois -> delta)
 *
 * Quando rodar: depois de mudancas na tabela de referencia TRI ou no
 * agregador erros_por_topico — para que o ranking historico fique na
 * mesma escala que novos submits.
 */

import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

import { recomputeSimuladoResposta } from './recompute-resposta'

// tsconfig.app.json restringe types a 'vite/client' — declaracao local
// de process pra esse spec rodar via vitest sem precisar de @types/node.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> }

const SUPABASE_URL = 'https://comwcnmvnuzqqbypjtqn.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

describe('recalculo TRI das respostas em producao', () => {
  it.runIf(Boolean(SERVICE_ROLE))(
    'recalcula todas as simulado_respostas e imprime diff',
    async () => {
      const client = createClient(SUPABASE_URL, SERVICE_ROLE!)

      // 1. Lista IDs
      const respList = await client
        .from('simulado_respostas')
        .select('id')
        .order('submitted_at', { ascending: true })

      expect(respList.error).toBeNull()
      const ids = (respList.data ?? []).map((r) => r.id as string)
      console.log(`\nEncontradas ${ids.length} respostas para recalcular.\n`)

      // 2. Recalcula uma a uma
      const diffs: Array<{ id: string; antes: Record<string, number | null>; depois: Record<string, number | null>; delta: Record<string, number | null> }> = []
      const erros: Array<{ id: string; msg: string }> = []

      for (const id of ids) {
        const res = await recomputeSimuladoResposta(client, id)
        if (res.ok) {
          diffs.push({
            id,
            antes: res.diff.tri_antes,
            depois: res.diff.tri_depois,
            delta: res.diff.delta,
          })
        } else {
          erros.push({ id, msg: `${res.error.kind}: ${res.error.message}` })
        }
      }

      // 3. Report
      console.log('=== DIFFS (TRI antes -> depois) ===')
      console.log('id (curto) | LC | CH | CN | MT')
      console.log('-'.repeat(80))
      for (const d of diffs) {
        const fmt = (a: number | null, b: number | null, dl: number | null) => {
          if (a == null && b == null) return '—'
          const aStr = a == null ? '—' : a.toFixed(0)
          const bStr = b == null ? '—' : b.toFixed(0)
          const dStr = dl == null ? '' : ` (${dl >= 0 ? '+' : ''}${dl.toFixed(1)})`
          return `${aStr}->${bStr}${dStr}`
        }
        console.log(
          `${d.id.slice(0, 8)} | ` +
            `${fmt(d.antes.LC, d.depois.LC, d.delta.LC)} | ` +
            `${fmt(d.antes.CH, d.depois.CH, d.delta.CH)} | ` +
            `${fmt(d.antes.CN, d.depois.CN, d.delta.CN)} | ` +
            `${fmt(d.antes.MT, d.depois.MT, d.delta.MT)}`,
        )
      }

      if (erros.length > 0) {
        console.log('\n=== ERROS ===')
        for (const e of erros) console.log(`${e.id.slice(0, 8)}: ${e.msg}`)
      }

      console.log(`\nResumo: ${diffs.length} OK, ${erros.length} falharam.`)
      expect(erros).toHaveLength(0)
    },
    120_000,
  )

  it('skipa quando SUPABASE_SERVICE_ROLE_KEY nao esta no env', () => {
    if (SERVICE_ROLE) {
      console.log('SERVICE_ROLE detectado — teste real rodou acima.')
    } else {
      console.log('SERVICE_ROLE ausente — pulando recalculo.')
    }
    expect(true).toBe(true)
  })
})
