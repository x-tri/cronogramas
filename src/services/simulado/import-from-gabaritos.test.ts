import { describe, it, expect } from 'vitest'

import {
  areaForNumero,
  validateExam,
  buildItens,
  buildResposta,
  matchByMatricula,
  buildImportPlan,
  type GabaritosExam,
  type SimuladoItemInsert,
  type GabaritosStudentAnswer,
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

function saFixture(over: Partial<GabaritosStudentAnswer> = {}): GabaritosStudentAnswer {
  return {
    student_number: '123', student_name: 'X', turma: 'A',
    answers: ALL_BLANK, tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500, ...over,
  }
}

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

// ---------------------------------------------------------------------------
// Task 3
// ---------------------------------------------------------------------------

describe('buildResposta', () => {
  const key = validKey()
  const itens = buildItens(examFixture({ answer_key: key,
    question_contents: Array.from({ length: 180 }, (_, i) => ({ answer: key[i], content: `t${i+1}`, questionNumber: i+1 })) }))

  it('invariante: cada área soma 45 e acerta as respostas corretas', () => {
    // responde TODAS corretas
    const answers = key.slice()
    const r = buildResposta(saFixture({ answers }), itens, 'stu-uuid')
    expect(r.student_id).toBe('stu-uuid')
    expect(r.acertos_lc + r.erros_lc + r.branco_lc).toBe(45)
    expect(r.acertos_ch + r.erros_ch + r.branco_ch).toBe(45)
    expect(r.acertos_cn + r.erros_cn + r.branco_cn).toBe(45)
    expect(r.acertos_mt + r.erros_mt + r.branco_mt).toBe(45)
    expect(r.acertos_lc).toBe(45)
    expect(r.correction_status).toBe('computed')
    expect(r.tri_method).toBe('gabaritos_import')
    expect(r.tri_lc).toBe(500)
  })

  it('TRI fora de escala (>1000 / <200 / null) vira null', () => {
    const r = buildResposta(saFixture({ tri_lc: 1500, tri_ch: 100, tri_cn: null, tri_mt: 700 }), itens, 's')
    expect(r.tri_lc).toBeNull()
    expect(r.tri_ch).toBeNull()
    expect(r.tri_cn).toBeNull()
    expect(r.tri_mt).toBe(700)
  })

  it('tudo em branco: 45 brancos por área, areas_realizadas vazio', () => {
    const r = buildResposta(saFixture({ answers: ALL_BLANK }), itens, 's')
    expect(r.branco_lc).toBe(45)
    expect(r.areas_realizadas).toEqual([])
  })

  it('answers mais curto que 180 trata posições ausentes como branco', () => {
    const r = buildResposta(saFixture({ answers: ['A'] }), itens, 's')
    expect(r.branco_lc + r.branco_ch + r.branco_cn + r.branco_mt).toBe(179)
    expect(r.acertos_lc).toBe(1) // posição 1 de LC, gabarito[0] == 'A' na validKey
  })

  it('respostas minúsculas são normalizadas', () => {
    const r = buildResposta(saFixture({ answers: validKey().map((l) => l.toLowerCase()) }), itens, 's')
    expect(r.acertos_lc).toBe(45)
  })

  it('TRI NaN / Infinity vira null', () => {
    const r = buildResposta(saFixture({ tri_lc: NaN, tri_ch: Infinity }), itens, 's')
    expect(r.tri_lc).toBeNull()
    expect(r.tri_ch).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Task 4
// ---------------------------------------------------------------------------

describe('matchByMatricula', () => {
  const byMat = new Map<string, string>([['214140291', 'uuid-nicole'], ['123', 'uuid-123']])
  it('casa exato', () => {
    expect(matchByMatricula('214140291', byMat)).toBe('uuid-nicole')
  })
  it('casa removendo zeros à esquerda', () => {
    expect(matchByMatricula('00123', byMat)).toBe('uuid-123')
  })
  it('retorna null sem match', () => {
    expect(matchByMatricula('999', byMat)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Task 5
// ---------------------------------------------------------------------------

describe('buildImportPlan', () => {
  const key = validKey()
  const exam = examFixture({ answer_key: key,
    question_contents: Array.from({ length: 180 }, (_, i) => ({ answer: key[i], content: `t${i+1}`, questionNumber: i+1 })) })
  const portal = [{ id: 'uuid-nicole', matricula: '214140291' }, { id: 'uuid-123', matricula: '123' }]

  it('separa importáveis e sem-match', () => {
    const sas = [
      saFixture({ student_number: '214140291', answers: key.slice() }),
      saFixture({ student_number: '999', answers: key.slice() }), // sem match
    ]
    const plan = buildImportPlan(exam, sas, portal)
    expect(plan.ok).toBe(true)
    expect(plan.itens).toHaveLength(180)
    expect(plan.respostas).toHaveLength(1)
    expect(plan.respostas[0].student_id).toBe('uuid-nicole')
    expect(plan.unmatched).toEqual(['999'])
  })

  it('exame inválido → ok=false, sem respostas', () => {
    const plan = buildImportPlan(examFixture({ answer_key: ['A'] }), [], portal)
    expect(plan.ok).toBe(false)
    expect(plan.respostas).toHaveLength(0)
  })
})
