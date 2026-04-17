/**
 * Testes do motor TRI Reference-Anchored.
 *
 * Cobre casos de fronteira (0 acertos, 45 acertos) e comportamento intermediario,
 * alem das utilidades calcTotals e groupErrorsBy.
 */

import { describe, expect, it } from 'vitest'

import {
  calcAllTRI,
  calcMediaGeral,
  calcTotals,
  groupErrorsBy,
  type ExamConfig,
} from './engine'
import { AREAS, PROFICIENCY_LEVELS, REF_TABLES, getProficiency } from './reference-tables'

/** Helper: cria gabarito de 180 itens (default: todos 'A'). */
function makeGabarito(letter = 'A'): string[] {
  return Array.from({ length: 180 }, () => letter)
}

/** Helper: cria dificuldades de 180 itens (default: 3 = media). */
function makeDifficulties(value = 3): number[] {
  return Array.from({ length: 180 }, () => value)
}

/** Helper: monta um ExamConfig completo de 180 itens. */
function makeExam(
  gabaritoLetter = 'A',
  difficulty = 3,
): ExamConfig {
  return {
    gabarito: makeGabarito(gabaritoLetter),
    difficulties: makeDifficulties(difficulty),
  }
}

describe('calcAllTRI — casos extremos', () => {
  it('180 em branco -> retorna objeto vazio (nenhuma area)', () => {
    const exam = makeExam('A')
    const answers = Array.from({ length: 180 }, () => '')
    const results = calcAllTRI(answers, exam)
    expect(results).toEqual({})
  })

  it('todas as respostas iguais ao gabarito -> score maximo por area', () => {
    const exam = makeExam('A')
    const answers = makeGabarito('A')
    const results = calcAllTRI(answers, exam)

    for (const area of AREAS) {
      const r = results[area.key]
      expect(r).toBeDefined()
      expect(r!.nCorrect).toBe(45)
      expect(r!.nAnswered).toBe(45)
      // Com 45 acertos (caso >= ref.length - 1), score = entry.mx da ultima entrada.
      const lastEntry = REF_TABLES[area.key]![REF_TABLES[area.key]!.length - 1]!
      expect(r!.score).toBe(lastEntry.mx)
      expect(r!.position).toBe(1)
    }
  })

  it('nenhuma resposta correta (todas B quando gabarito e A) -> piso por area', () => {
    const exam = makeExam('A')
    const answers = makeGabarito('B')
    const results = calcAllTRI(answers, exam)

    for (const area of AREAS) {
      const r = results[area.key]
      expect(r).toBeDefined()
      expect(r!.nCorrect).toBe(0)
      expect(r!.nAnswered).toBe(45)
      // Com 0 acertos, score = entry.mn da primeira entrada.
      const firstEntry = REF_TABLES[area.key]![0]!
      expect(r!.score).toBe(firstEntry.mn)
      expect(r!.position).toBe(0)
    }
  })
})

describe('calcAllTRI — intermediario', () => {
  it('metade das respostas corretas em cada area -> score dentro da faixa [mn, mx]', () => {
    const exam = makeExam('A', 3)
    // Acerta as primeiras 22 (metade arredondada para baixo) de cada bloco de 45.
    const answers = makeGabarito('B') // erradas por default
    for (const area of AREAS) {
      const start = area.range[0] - 1
      for (let i = start; i < start + 22; i++) {
        answers[i] = 'A'
      }
    }

    const results = calcAllTRI(answers, exam)

    for (const area of AREAS) {
      const r = results[area.key]
      expect(r).toBeDefined()
      expect(r!.nCorrect).toBe(22)
      const refEntry = REF_TABLES[area.key]![22]!
      expect(r!.score).toBeGreaterThanOrEqual(refEntry.mn)
      expect(r!.score).toBeLessThanOrEqual(refEntry.mx)
      expect(r!.position).toBeGreaterThanOrEqual(0)
      expect(r!.position).toBeLessThanOrEqual(1)
    }
  })

  it('acertar os itens mais dificeis deve gerar score >= acertar os mais faceis', () => {
    // Gabarito uniforme, dificuldade variada: primeiros 22 itens da area sao faceis (1), resto dificil (5).
    const gabarito = makeGabarito('A')
    const difficulties = makeDifficulties(1)
    const areaLC = AREAS[0]!
    const startLC = areaLC.range[0] - 1
    for (let i = startLC + 22; i < startLC + 45; i++) {
      difficulties[i] = 5
    }

    const exam: ExamConfig = { gabarito, difficulties }

    // Cenario A: acerta os 22 mais faceis (dif=1).
    const answersFaceis = makeGabarito('B')
    for (let i = startLC; i < startLC + 22; i++) answersFaceis[i] = 'A'

    // Cenario B: acerta os 22 mais dificeis (dif=5). Mas como so ha 23 dificeis, pegamos 22.
    const answersDificeis = makeGabarito('B')
    for (let i = startLC + 22; i < startLC + 44; i++) answersDificeis[i] = 'A'

    const scoreFaceis = calcAllTRI(answersFaceis, exam).LC!.score
    const scoreDificeis = calcAllTRI(answersDificeis, exam).LC!.score

    expect(scoreDificeis).toBeGreaterThan(scoreFaceis)
  })
})

describe('calcTotals', () => {
  it('conta acertos, erros e branco corretamente', () => {
    const gabarito = makeGabarito('A')
    const answers = makeGabarito('A')
    // 10 erros
    for (let i = 0; i < 10; i++) answers[i] = 'B'
    // 20 em branco
    for (let i = 10; i < 30; i++) answers[i] = ''

    const totals = calcTotals(answers, gabarito)
    expect(totals.acertos).toBe(150)
    expect(totals.erros).toBe(10)
    expect(totals.branco).toBe(20)
    expect(totals.respondidas).toBe(160)
  })

  it('trata espacos, hifens e case-insensitive', () => {
    const gabarito = makeGabarito('A')
    const answers = makeGabarito('a') // lowercase
    answers[0] = ' '  // branco
    answers[1] = '-'  // branco
    answers[2] = 'b'  // erro
    const totals = calcTotals(answers, gabarito)
    expect(totals.branco).toBe(2)
    expect(totals.erros).toBe(1)
    expect(totals.acertos).toBe(177)
  })
})

describe('groupErrorsBy', () => {
  it('agrupa erros por label ignorando itens sem label ou em branco', () => {
    const gabarito = makeGabarito('A')
    const answers = makeGabarito('A')
    answers[0] = 'B'   // erro, label "X"
    answers[1] = 'B'   // erro, label "X"
    answers[2] = 'B'   // erro, label "Y"
    answers[3] = 'B'   // erro, label null -> ignora
    answers[4] = ''    // branco -> ignora
    answers[5] = 'A'   // acerto -> ignora

    const labels: (string | null | undefined)[] = Array.from({ length: 180 }, () => 'Z')
    labels[0] = 'X'
    labels[1] = 'X'
    labels[2] = 'Y'
    labels[3] = null
    labels[4] = 'W'
    labels[5] = 'V'

    const errors = groupErrorsBy(answers, gabarito, labels)
    expect(errors).toEqual({ X: 2, Y: 1 })
  })
})

describe('calcMediaGeral', () => {
  it('retorna null quando nenhuma area foi respondida', () => {
    expect(calcMediaGeral({}, null)).toBeNull()
  })

  it('calcula media sem redacao', () => {
    const results = calcAllTRI(makeGabarito('A'), makeExam('A'))
    const media = calcMediaGeral(results, null)
    expect(media).toBeGreaterThan(800) // todas no teto -> media alta
  })

  it('inclui redacao quando informada', () => {
    const results = calcAllTRI(makeGabarito('A'), makeExam('A'))
    const media = calcMediaGeral(results, 1000)
    expect(media).toBeGreaterThan(900)
  })
})

describe('precondicao de tamanho de array', () => {
  it('calcAllTRI lanca se answers tem menos que 180 itens', () => {
    const exam = makeExam('A')
    const answers = Array.from({ length: 45 }, () => 'A') // so uma area
    expect(() => calcAllTRI(answers, exam)).toThrow(/180/)
  })

  it('calcTotals lanca se gabarito tem menos que 180 itens', () => {
    expect(() => calcTotals(makeGabarito('A'), ['A', 'B'])).toThrow(/180/)
  })

  it('groupErrorsBy lanca se itemLabels tem menos que 180 itens', () => {
    expect(() =>
      groupErrorsBy(makeGabarito('A'), makeGabarito('A'), ['x']),
    ).toThrow(/180/)
  })
})

describe('getProficiency', () => {
  it('mapeia score para nivel correto', () => {
    expect(getProficiency(300)?.label).toBe(PROFICIENCY_LEVELS[0]!.label)
    expect(getProficiency(500)?.label).toBe(PROFICIENCY_LEVELS[1]!.label)
    expect(getProficiency(600)?.label).toBe(PROFICIENCY_LEVELS[2]!.label)
    expect(getProficiency(800)?.label).toBe(PROFICIENCY_LEVELS[3]!.label)
  })

  it('retorna null para score nulo', () => {
    expect(getProficiency(null)).toBeNull()
    expect(getProficiency(undefined)).toBeNull()
  })
})
