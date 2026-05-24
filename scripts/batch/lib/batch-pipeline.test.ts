import { describe, it, expect } from 'vitest'

import {
  extractWrongQuestions,
  dedupTopics,
  parseTopicLabel,
  areaForQuestion,
} from './topic-extraction'
import { buildSchedulableSlots, summarizeSlots } from './slot-builder'
import { distributeTopicsToSlots } from './distribute'

describe('parseTopicLabel', () => {
  it('strips Qn - prefix', () => {
    expect(parseTopicLabel('Q15 - Gramática (Sintaxe)').display).toBe(
      'Gramática (Sintaxe)',
    )
  })

  it('normalizes accents and spaces in key', () => {
    expect(parseTopicLabel('Q1 - Genética e Evolução').key).toBe(
      'genetica-e-evolucao',
    )
  })

  it('topics differing only in question number get same key', () => {
    const a = parseTopicLabel('Q3 - Interpretação de Texto').key
    const b = parseTopicLabel('Q5 - Interpretação de Texto').key
    expect(a).toBe(b)
  })
})

describe('areaForQuestion', () => {
  it('maps questions to areas', () => {
    expect(areaForQuestion(1)).toBe('LC')
    expect(areaForQuestion(45)).toBe('LC')
    expect(areaForQuestion(46)).toBe('CH')
    expect(areaForQuestion(90)).toBe('CH')
    expect(areaForQuestion(91)).toBe('CN')
    expect(areaForQuestion(180)).toBe('MT')
  })
})

describe('extractWrongQuestions', () => {
  it('returns empty for empty inputs', () => {
    expect(extractWrongQuestions([], [])).toEqual([])
    expect(extractWrongQuestions(null, ['A'])).toEqual([])
  })

  it('ignores blanks (X, NULL, vazio)', () => {
    const answers = ['A', 'X', '', 'B']
    const key = ['B', 'A', 'C', 'B']
    const wrong = extractWrongQuestions(answers, key)
    // Q1 errado (A != B), Q2 e Q3 brancos, Q4 acerto
    expect(wrong.map((w) => w.questionNumber)).toEqual([1])
  })

  it('detects all wrong answers with correct topic mapping', () => {
    const answers = ['B', 'A', 'A', 'C']
    const key = ['A', 'A', 'B', 'A']
    const wrong = extractWrongQuestions(answers, key)
    // Q1: B vs A errado; Q2: A vs A certo; Q3: A vs B errado; Q4: C vs A errado
    expect(wrong.map((w) => w.questionNumber)).toEqual([1, 3, 4])
  })
})

describe('dedupTopics — constraint do produto', () => {
  it('3 questões do mesmo tópico => 1 entrada (genética, genética, genética => 1)', () => {
    // Q1, Q2, Q3 estão todas em 'Interpretação de Texto' (range 1-5)
    const wrong = extractWrongQuestions(['B', 'B', 'B'], ['A', 'A', 'A'])
    const dedup = dedupTopics(wrong)
    expect(dedup).toHaveLength(1)
    expect(dedup[0].errorCount).toBe(3)
    expect(dedup[0].questionNumbers).toEqual([1, 2, 3])
  })

  it('mantém tópicos distintos separados', () => {
    // Q1 (Interpretação) + Q11 (Sintaxe) + Q21 (Funções)
    const answers = Array(45).fill('Z')
    answers[0] = 'B' // Q1 errado
    answers[10] = 'B' // Q11 errado
    answers[20] = 'B' // Q21 errado
    const key = Array(45).fill('A')
    const wrong = extractWrongQuestions(answers, key)
    const dedup = dedupTopics(wrong)
    expect(dedup).toHaveLength(3)
    expect(new Set(dedup.map((d) => d.topicKey)).size).toBe(3)
  })
})

describe('buildSchedulableSlots — constraint dos turnos', () => {
  it('default: sem manhã em dias úteis, livre fim de semana', () => {
    const slots = buildSchedulableSlots()
    const weekdayMorning = slots.filter(
      (s) =>
        !['sabado', 'domingo'].includes(s.diaSemana) && s.turno === 'manha',
    )
    expect(weekdayMorning).toHaveLength(0)

    const weekendMorning = slots.filter(
      (s) => ['sabado', 'domingo'].includes(s.diaSemana) && s.turno === 'manha',
    )
    expect(weekendMorning.length).toBeGreaterThan(0)
  })

  it('opt-in para incluir manhã em dias úteis', () => {
    const slots = buildSchedulableSlots({ blockWeekdayMorning: false })
    const weekdayMorning = slots.filter(
      (s) =>
        !['sabado', 'domingo'].includes(s.diaSemana) && s.turno === 'manha',
    )
    expect(weekdayMorning.length).toBeGreaterThan(0)
  })

  it('total esperado: 40 weekday + 30 weekend = 70 slots', () => {
    const slots = buildSchedulableSlots()
    const summary = summarizeSlots(slots)
    // 5 weekdays × (5 tarde + 3 noite) = 40
    // 2 weekend × (7 manha + 5 tarde + 3 noite) = 30
    expect(summary.total).toBe(70)
  })

  it('slots ordenados seg→dom dentro do dia manha→tarde→noite', () => {
    const slots = buildSchedulableSlots()
    // segunda primeira; tarde antes de noite no mesmo dia
    expect(slots[0].diaSemana).toBe('segunda')
    expect(slots[0].turno).toBe('tarde')
  })
})

describe('distributeTopicsToSlots', () => {
  it('atribui top-N tópicos a N slots por errorCount DESC', () => {
    const slots = buildSchedulableSlots()
    const topics = [
      { topicKey: 'low', topicDisplay: 'Low', questionNumbers: [50], errorCount: 1 },
      { topicKey: 'high', topicDisplay: 'High', questionNumbers: [1, 2, 3], errorCount: 3 },
      { topicKey: 'mid', topicDisplay: 'Mid', questionNumbers: [100, 101], errorCount: 2 },
    ]
    const { scheduled, dropped } = distributeTopicsToSlots(topics, slots)
    expect(scheduled).toHaveLength(3)
    expect(dropped).toHaveLength(0)
    // Ordem por prioridade
    expect(scheduled[0].titulo).toBe('High')
    expect(scheduled[1].titulo).toBe('Mid')
    expect(scheduled[2].titulo).toBe('Low')
  })

  it('descarta excedente se tópicos > slots', () => {
    const slots = [
      {
        diaSemana: 'segunda' as const,
        turno: 'tarde' as const,
        horarioInicio: '14:35',
        horarioFim: '15:25',
      },
    ]
    const topics = [
      { topicKey: 'a', topicDisplay: 'A', questionNumbers: [1], errorCount: 5 },
      { topicKey: 'b', topicDisplay: 'B', questionNumbers: [2], errorCount: 3 },
    ]
    const { scheduled, dropped } = distributeTopicsToSlots(topics, slots)
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].titulo).toBe('A')
    expect(dropped).toHaveLength(1)
    expect(dropped[0].topicDisplay).toBe('B')
  })

  it('atribui cor da área correta', () => {
    const slots = buildSchedulableSlots()
    const topics = [
      { topicKey: 't', topicDisplay: 'X', questionNumbers: [150], errorCount: 1 },
    ]
    const { scheduled } = distributeTopicsToSlots(topics, slots)
    expect(scheduled[0].area).toBe('MT') // Q150 está em MT
    expect(scheduled[0].cor).toBe('#EF4444')
  })

  it('nunca atribui slot de manhã em dia útil (constraint passa pelo builder)', () => {
    const slots = buildSchedulableSlots() // sem manhã weekday
    const topics = Array.from({ length: 70 }, (_, i) => ({
      topicKey: `t${i}`,
      topicDisplay: `T${i}`,
      questionNumbers: [i + 1],
      errorCount: 1,
    }))
    const { scheduled } = distributeTopicsToSlots(topics, slots)
    const violation = scheduled.find(
      (b) =>
        !['sabado', 'domingo'].includes(b.diaSemana) && b.turno === 'manha',
    )
    expect(violation).toBeUndefined()
  })
})
