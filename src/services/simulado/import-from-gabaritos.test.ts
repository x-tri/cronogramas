import { describe, it, expect } from 'vitest'

import {
  areaForNumero,
  validateExam,
  type GabaritosExam,
} from './import-from-gabaritos.ts'

// ---------------------------------------------------------------------------
// Shared helpers (definidos UMA vez)
// ---------------------------------------------------------------------------

function validKey(): string[] {
  // 180 letras A-E quaisquer, válidas
  return Array.from({ length: 180 }, (_, i) => 'ABCDE'[i % 5])
}

function examFixture(over: Partial<GabaritosExam> = {}): GabaritosExam {
  return { id: 'e1', title: 'Prova X', answer_key: validKey(), question_contents: null, ...over }
}

const ALL_BLANK = Array.from({ length: 180 }, () => '')

// ---------------------------------------------------------------------------
// Task 1
// ---------------------------------------------------------------------------

describe('areaForNumero', () => {
  it('mapeia faixas ENEM', () => {
    expect(areaForNumero(1)).toBe('LC')
    expect(areaForNumero(45)).toBe('LC')
    expect(areaForNumero(46)).toBe('CH')
    expect(areaForNumero(90)).toBe('CH')
    expect(areaForNumero(91)).toBe('CN')
    expect(areaForNumero(135)).toBe('CN')
    expect(areaForNumero(136)).toBe('MT')
    expect(areaForNumero(180)).toBe('MT')
  })
})

describe('validateExam', () => {
  it('aceita exame ENEM 180 válido', () => {
    expect(validateExam(examFixture()).ok).toBe(true)
  })
  it('rejeita answer_key != 180', () => {
    const r = validateExam(examFixture({ answer_key: ['A', 'B'] }))
    expect(r.ok).toBe(false)
    expect(r.reasons.join(' ')).toContain('180')
  })
  it('rejeita letra inválida', () => {
    const key = validKey(); key[10] = 'Z'
    const r = validateExam(examFixture({ answer_key: key }))
    expect(r.ok).toBe(false)
    expect(r.reasons.join(' ')).toContain('letra')
  })
})
