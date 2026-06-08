import { describe, expect, it } from 'vitest'

import {
  computeItemAudits,
  computeResponseIntegrity,
  confidenceFromAreas,
  type AuditItemInput,
  type AuditResponseInput,
} from './item-audit'

function makeItems(): AuditItemInput[] {
  return Array.from({ length: 180 }, (_, idx) => {
    const numero = idx + 1
    const area = numero <= 45 ? 'LC' : numero <= 90 ? 'CH' : numero <= 135 ? 'CN' : 'MT'
    return {
      id: `item-${numero}`,
      simulado_id: 'sim-1',
      numero,
      area,
      gabarito: 'A',
      dificuldade: numero === 1 ? 5 : 3,
    }
  })
}

function makeResponse(id: string, answers: Record<string, string>): AuditResponseInput {
  const items = makeItems()
  const totals = {
    LC: { acertos: 0, erros: 0, branco: 0 },
    CH: { acertos: 0, erros: 0, branco: 0 },
    CN: { acertos: 0, erros: 0, branco: 0 },
    MT: { acertos: 0, erros: 0, branco: 0 },
  }
  for (const item of items) {
    const ans = (answers[String(item.numero)] ?? '').trim().toUpperCase()
    if (!ans) totals[item.area].branco++
    else if (ans === item.gabarito) totals[item.area].acertos++
    else totals[item.area].erros++
  }
  return {
    id,
    answers,
    acertos_lc: totals.LC.acertos,
    erros_lc: totals.LC.erros,
    branco_lc: totals.LC.branco,
    acertos_ch: totals.CH.acertos,
    erros_ch: totals.CH.erros,
    branco_ch: totals.CH.branco,
    acertos_cn: totals.CN.acertos,
    erros_cn: totals.CN.erros,
    branco_cn: totals.CN.branco,
    acertos_mt: totals.MT.acertos,
    erros_mt: totals.MT.erros,
    branco_mt: totals.MT.branco,
  }
}

function answersFor(item1: string, rest2to20: string): Record<string, string> {
  const a: Record<string, string> = { '1': item1 }
  for (let n = 2; n <= 20; n++) a[String(n)] = rest2to20
  return a
}

describe('computeResponseIntegrity', () => {
  it('confirma totais quando answers e agregados batem', () => {
    const items = makeItems()
    const response = makeResponse('r1', { '1': 'A', '2': 'B' })

    const integrity = computeResponseIntegrity(items, [response])

    expect(integrity.invalid_answers_total).toBe(0)
    expect(integrity.respostas_com_mismatch).toBe(0)
    expect(integrity.mismatch_lc).toBe(0)
  })

  it('detecta alternativa invalida e mismatch de totais salvos', () => {
    const items = makeItems()
    const response = {
      ...makeResponse('r1', { '1': 'Z', '2': 'A' }),
      acertos_lc: 99,
    }

    const integrity = computeResponseIntegrity(items, [response])

    expect(integrity.invalid_answers_total).toBe(1)
    expect(integrity.respostas_com_mismatch).toBe(1)
    expect(integrity.mismatch_lc).toBe(1)
  })
})

describe('computeItemAudits', () => {
  it('sinaliza revisão de gabarito quando outra alternativa concentra marcações', () => {
    const items = makeItems()
    const responses = Array.from({ length: 10 }, (_, idx) =>
      makeResponse(`r-${idx}`, { '1': idx < 7 ? 'B' : 'A' }),
    )

    const audit = computeItemAudits(items, responses).find((a) => a.numero === 1)!

    expect(audit.n_respostas).toBe(10)
    expect(audit.alternativa_mais_marcada).toBe('B')
    expect(audit.classifications).toContain('sinal_revisao_gabarito')
    expect(audit.classifications).toContain('amostra_insuficiente')
    expect(audit.classifications).toContain('bloqueado_para_recalculo')
    expect(audit.recalculo_bloqueado).toBe(true)
  })

  it('não usa área não realizada como branco na auditoria do item', () => {
    const items = makeItems()
    const responses = [
      makeResponse('r1', { '1': 'A' }),
      makeResponse('r2', { '46': 'A' }),
    ]

    const lcAudit = computeItemAudits(items, responses).find((a) => a.numero === 1)!
    const chAudit = computeItemAudits(items, responses).find((a) => a.numero === 46)!

    expect(lcAudit.n_respostas).toBe(1)
    expect(lcAudit.n_brancos).toBe(0)
    expect(chAudit.n_respostas).toBe(1)
    expect(chAudit.n_brancos).toBe(0)
  })

  it('marca gabarito provável errado quando o distrator domina e a discriminação é não-positiva', () => {
    const items = makeItems()
    // 6 alunos que acertam o resto (2-20) marcam B no item 1 (errado); 4 que erram o
    // resto marcam A (gabarito) -> distrator domina e discriminação fica negativa.
    const responses = [
      ...Array.from({ length: 6 }, (_, i) => makeResponse(`forte-${i}`, answersFor('B', 'A'))),
      ...Array.from({ length: 4 }, (_, i) => makeResponse(`fraco-${i}`, answersFor('A', 'B'))),
    ]

    const item1 = computeItemAudits(items, responses).find((a) => a.numero === 1)!

    expect(item1.alternativa_mais_marcada).toBe('B')
    expect(item1.discriminacao_proxy).not.toBeNull()
    expect(item1.discriminacao_proxy!).toBeLessThanOrEqual(0)
    expect(item1.classifications).toContain('gabarito_provavel_errado')
    // o sinal forte substitui o genérico e item com sinal nunca é "confiável"
    expect(item1.classifications).not.toContain('sinal_revisao_gabarito')
    expect(item1.classifications).not.toContain('confiavel_operacionalmente')
  })

  it('marca confiável operacionalmente apenas quando o item não tem nenhum sinal de revisão', () => {
    const items = makeItems()
    const responses = [
      ...Array.from({ length: 6 }, (_, i) => makeResponse(`forte-${i}`, answersFor('B', 'A'))),
      ...Array.from({ length: 4 }, (_, i) => makeResponse(`fraco-${i}`, answersFor('A', 'B'))),
    ]

    const audits = computeItemAudits(items, responses)
    const item1 = audits.find((a) => a.numero === 1)! // tem sinal de revisão
    const item2 = audits.find((a) => a.numero === 2)! // limpo: gabarito A, maioria acerta, disc positiva

    expect(item1.classifications).not.toContain('confiavel_operacionalmente')
    expect(item2.classifications).toContain('confiavel_operacionalmente')
    expect(
      item2.classifications.some((c) => c === 'gabarito_provavel_errado' || c.startsWith('sinal_')),
    ).toBe(false)
  })
})

describe('confidenceFromAreas', () => {
  it('classifica alta somente com 4 áreas bem respondidas', () => {
    expect(
      confidenceFromAreas({
        LC: { acertos: 20, erros: 20 },
        CH: { acertos: 20, erros: 20 },
        CN: { acertos: 20, erros: 20 },
        MT: { acertos: 20, erros: 20 },
      }),
    ).toBe('high')
  })

  it('classifica parcial de uma área como low', () => {
    expect(
      confidenceFromAreas({
        LC: { acertos: 20, erros: 20 },
        CH: { acertos: 0, erros: 0 },
        CN: { acertos: 0, erros: 0 },
        MT: { acertos: 0, erros: 0 },
      }),
    ).toBe('low')
  })
})
