import { describe, expect, it } from 'vitest'

import {
  AREA_TO_DISCIPLINE,
  filterValidForTri,
  mapApiToOptions,
  mapApiToQuestionCandidate,
  paramBToBucket,
  type ApiQuestion,
} from './api-questoes-xtri'

// Fixture baseada em response real de /api/questions/17488/ + 17382 (ENEM 2024)
function makeApiQuestion(overrides: Partial<ApiQuestion> = {}): ApiQuestion {
  return {
    id: 17382,
    title: 'Questão 17 - ENEM 2024',
    index: 17,
    year: 2024,
    slug: '17',
    discipline: 'linguagens',
    language: null,
    skill: { area: 'LC', code: 'H23', label: 'Inferir...' },
    image: null,
    correctAlternative: 'E',
    param_b: 0.96695,
    param_a: null,
    param_c: null,
    in_item_aban: false,
    context: 'Texto base...',
    alternativesIntroduction: 'No texto, o autor',
    alternatives: [
      { letter: 'A', text: 'opt A', image: null, file: null, localFile: null, isCorrect: false },
      { letter: 'B', text: 'opt B', image: null, file: null, localFile: null, isCorrect: false },
      { letter: 'C', text: 'opt C', image: null, file: null, localFile: null, isCorrect: false },
      { letter: 'D', text: 'opt D', image: null, file: null, localFile: null, isCorrect: false },
      { letter: 'E', text: 'opt E (gabarito)', image: null, file: null, localFile: null, isCorrect: true },
    ],
    ...overrides,
  }
}

describe('AREA_TO_DISCIPLINE', () => {
  it('mapeia as 4 areas para os enums da API', () => {
    expect(AREA_TO_DISCIPLINE.LC).toBe('linguagens')
    expect(AREA_TO_DISCIPLINE.CH).toBe('ciencias-humanas')
    expect(AREA_TO_DISCIPLINE.CN).toBe('ciencias-natureza')
    expect(AREA_TO_DISCIPLINE.MT).toBe('matematica')
  })
})

describe('paramBToBucket', () => {
  it('null ou undefined -> null', () => {
    expect(paramBToBucket(null)).toBeNull()
    expect(paramBToBucket(undefined)).toBeNull()
  })

  it('classifica conforme limites TRI', () => {
    expect(paramBToBucket(-1.5)).toBe('VERY_EASY')
    expect(paramBToBucket(-0.5)).toBe('EASY')
    expect(paramBToBucket(0)).toBe('MEDIUM')
    expect(paramBToBucket(0.96)).toBe('MEDIUM')
    expect(paramBToBucket(1.5)).toBe('HARD')
    expect(paramBToBucket(2.5)).toBe('VERY_HARD')
  })

  it('limites exatos sao classificados como o bucket superior', () => {
    expect(paramBToBucket(-1)).toBe('EASY')
    expect(paramBToBucket(0)).toBe('MEDIUM')
    expect(paramBToBucket(1)).toBe('HARD')
    expect(paramBToBucket(2)).toBe('VERY_HARD')
  })
})

describe('mapApiToQuestionCandidate', () => {
  it('mapeia campos basicos para o formato legado', () => {
    const q = makeApiQuestion()
    const row = mapApiToQuestionCandidate(q)
    expect(row.id).toBe('17382')
    expect(row.source_year).toBe(2024)
    expect(row.source_question).toBe(17)
    expect(row.source_exam).toBe('ENEM 2024')
    expect(row.stem).toBe('No texto, o autor')
    expect(row.support_text).toBe('Texto base...')
    expect(row.difficulty).toBe('MEDIUM') // param_b=0.96 -> MEDIUM
  })

  it('inclui language no source_exam quando presente (LC ingles/espanhol)', () => {
    const q = makeApiQuestion({ language: 'espanhol', year: 2025 })
    const row = mapApiToQuestionCandidate(q)
    expect(row.source_exam).toBe('ENEM 2025 espanhol')
  })

  it('difficulty=null quando param_b ausente (ex: ENEM 2025)', () => {
    const q = makeApiQuestion({ year: 2025, param_b: null })
    expect(mapApiToQuestionCandidate(q).difficulty).toBeNull()
  })
})

describe('mapApiToOptions', () => {
  it('preserva ordem A-E e marca isCorrect', () => {
    const opts = mapApiToOptions(makeApiQuestion())
    expect(opts).toHaveLength(5)
    expect(opts[0]?.letter).toBe('A')
    expect(opts[4]?.is_correct).toBe(true)
    expect(opts.find((o) => o.is_correct)?.letter).toBe('E')
  })

  it('retorna [] quando alternatives ausentes (caso listing endpoint)', () => {
    const q = { ...makeApiQuestion(), alternatives: undefined }
    expect(mapApiToOptions(q)).toEqual([])
  })
})

describe('filterValidForTri', () => {
  it('remove itens abandonados', () => {
    const list = [
      makeApiQuestion({ id: 1, in_item_aban: false }),
      makeApiQuestion({ id: 2, in_item_aban: true }),
    ]
    const filtered = filterValidForTri(list)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe(1)
  })

  it('quando requireParamB=true, exclui questoes sem param_b (ex: ENEM 2025)', () => {
    const list = [
      makeApiQuestion({ id: 1, param_b: 0.5 }),
      makeApiQuestion({ id: 2, year: 2025, param_b: null }),
    ]
    expect(filterValidForTri(list, { requireParamB: true })).toHaveLength(1)
    expect(filterValidForTri(list, { requireParamB: false })).toHaveLength(2)
  })

  it('combina os 2 filtros', () => {
    const list = [
      makeApiQuestion({ id: 1, in_item_aban: false, param_b: 0.5 }),
      makeApiQuestion({ id: 2, in_item_aban: true, param_b: 0.5 }),
      makeApiQuestion({ id: 3, in_item_aban: false, param_b: null }),
    ]
    expect(filterValidForTri(list, { requireParamB: true })).toHaveLength(1)
  })
})
