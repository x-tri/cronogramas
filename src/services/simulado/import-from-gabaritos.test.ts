import { describe, it, expect } from 'vitest'

import {
  areaForNumero,
  validateExam,
  buildItens,
  type GabaritosExam,
  type SimuladoItemInsert,
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

// ---------------------------------------------------------------------------
// Task 2
// ---------------------------------------------------------------------------

describe('buildItens', () => {
  it('gera 180 itens com área por posição e gabarito da chave', () => {
    const key = validKey()
    const qc = Array.from({ length: 180 }, (_, i) => ({
      answer: key[i], content: `topico ${i + 1}`, questionNumber: i + 1,
    }))
    const itens: SimuladoItemInsert[] = buildItens(examFixture({ answer_key: key, question_contents: qc }))
    expect(itens).toHaveLength(180)
    expect(itens[0]).toEqual({
      numero: 1, area: 'LC', gabarito: key[0], dificuldade: 3, topico: 'topico 1', habilidade: null,
    })
    expect(itens[45].area).toBe('CH')
    expect(itens[179].area).toBe('MT')
    expect(itens.every((it) => it.dificuldade === 3)).toBe(true)
  })
  it('topico = null quando não há question_contents', () => {
    const itens = buildItens(examFixture({ question_contents: null }))
    expect(itens[0].topico).toBeNull()
  })
})
