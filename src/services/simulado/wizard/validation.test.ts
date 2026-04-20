/**
 * Testes de validacao do wizard (Fase 3.2).
 */

import { describe, it, expect } from 'vitest'

import type { SimuladoItemDraft } from './csv-parser.ts'
import {
  validateMeta,
  summarizeItems,
  canSubmit,
  formatGapsMessage,
} from './validation.ts'

function makeItem(n: number): SimuladoItemDraft {
  return {
    numero: n,
    gabarito: 'A',
    dificuldade: 3,
    topico: `T${n}`,
  }
}

function makeFullItems(): SimuladoItemDraft[] {
  return Array.from({ length: 180 }, (_, i) => makeItem(i + 1))
}

// ---------------------------------------------------------------------
// validateMeta
// ---------------------------------------------------------------------

describe('validateMeta', () => {
  it('aceita meta valido', () => {
    expect(validateMeta({ title: 'Simulado 1', schoolId: 'a', turmas: [] })).toEqual([])
  })

  it('rejeita title vazio', () => {
    const issues = validateMeta({ title: '   ', schoolId: 'a', turmas: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toEqual({ kind: 'title_empty' })
  })

  it('rejeita title > 120 chars', () => {
    const long = 'x'.repeat(121)
    const issues = validateMeta({ title: long, schoolId: 'a', turmas: [] })
    expect(issues).toContainEqual({ kind: 'title_too_long', max: 120 })
  })

  it('rejeita school_id vazio', () => {
    const issues = validateMeta({ title: 'ok', schoolId: '', turmas: [] })
    expect(issues).toContainEqual({ kind: 'school_required' })
  })

  it('aceita turmas vazio (= todas)', () => {
    const issues = validateMeta({ title: 'ok', schoolId: 'a', turmas: [] })
    expect(issues).toEqual([])
  })
})

// ---------------------------------------------------------------------
// summarizeItems
// ---------------------------------------------------------------------

describe('summarizeItems', () => {
  it('exame completo: isComplete=true, sem gaps nem duplicatas', () => {
    const s = summarizeItems(makeFullItems())
    expect(s.isComplete).toBe(true)
    expect(s.total).toBe(180)
    expect(s.byArea).toEqual({ LC: 45, CH: 45, CN: 45, MT: 45 })
    expect(s.gaps).toEqual([])
    expect(s.duplicateNumeros).toEqual([])
    expect(s.missingAreas).toEqual([])
  })

  it('itens faltando: reporta gaps e missingAreas', () => {
    const partial = [makeItem(1), makeItem(2), makeItem(3)]
    const s = summarizeItems(partial)
    expect(s.isComplete).toBe(false)
    expect(s.total).toBe(3)
    expect(s.gaps).toHaveLength(177)
    expect(s.gaps[0]).toBe(4)
    expect(s.missingAreas).toEqual(['LC', 'CH', 'CN', 'MT'])
  })

  it('detecta duplicatas', () => {
    const items = [makeItem(1), makeItem(1), makeItem(2)]
    const s = summarizeItems(items)
    expect(s.duplicateNumeros).toEqual([1])
    expect(s.isComplete).toBe(false)
  })

  it('byArea contabiliza parcialmente', () => {
    const items: SimuladoItemDraft[] = [
      makeItem(1),   // LC
      makeItem(50),  // CH
      makeItem(100), // CN
      makeItem(150), // MT
    ]
    const s = summarizeItems(items)
    expect(s.byArea).toEqual({ LC: 1, CH: 1, CN: 1, MT: 1 })
    expect(s.missingAreas).toEqual(['LC', 'CH', 'CN', 'MT'])
  })
})

// ---------------------------------------------------------------------
// canSubmit
// ---------------------------------------------------------------------

describe('canSubmit', () => {
  const meta = { title: 'ENEM Sim', schoolId: 's1', turmas: [] }

  it('true quando meta valido + 180 itens completos', () => {
    expect(canSubmit(meta, makeFullItems())).toBe(true)
  })

  it('false com meta invalido', () => {
    expect(canSubmit({ ...meta, title: '' }, makeFullItems())).toBe(false)
  })

  it('false com itens incompletos', () => {
    const partial = makeFullItems().slice(0, 100)
    expect(canSubmit(meta, partial)).toBe(false)
  })

  it('false com duplicatas', () => {
    const dup = [...makeFullItems(), makeItem(1)]
    expect(canSubmit(meta, dup)).toBe(false)
  })
})

// ---------------------------------------------------------------------
// formatGapsMessage
// ---------------------------------------------------------------------

describe('formatGapsMessage', () => {
  it('vazio sem gaps', () => {
    expect(formatGapsMessage([])).toBe('')
  })

  it('mostra todos se <= 5', () => {
    expect(formatGapsMessage([1, 2, 3])).toBe('faltam 3 itens: 1, 2, 3')
  })

  it('abrevia com sufixo se > 5', () => {
    expect(formatGapsMessage([1, 2, 3, 4, 5, 6, 7])).toBe(
      'faltam 7 itens: 1, 2, 3, 4, 5, ... (+2)',
    )
  })
})
