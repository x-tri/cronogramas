import { describe, expect, it } from 'vitest'
import {
  computeCoverageScore,
  describeMentorPlanGeneration,
  describePlanGenerationMode,
  resolvePlanGenerationMode,
  resolveTaxonomySourceKind,
} from './mentor-intelligence'
import type { ExamQuestionTopic } from '../types/mentor-intelligence'

function buildMapping(id: string, topicId: string): ExamQuestionTopic {
  return {
    id,
    examId: `exam-${id}`,
    questionNumber: Number(id) || 1,
    topicId,
    mappingSource: 'manual',
    confidence: 1,
    reviewStatus: 'approved',
    reviewedBy: null,
    reviewedAt: null,
    isActive: true,
    sourceContext: 'production',
    sourceReference: null,
    createdAt: new Date().toISOString(),
    topic: {
      id: topicId,
      areaSigla: 'MT',
      subjectLabel: 'Matemática',
      topicLabel: `Tópico ${topicId}`,
      canonicalLabel: `Tópico ${topicId}`,
      isActive: true,
      originSourceContext: 'production',
      originSourceReference: null,
      createdAt: new Date().toISOString(),
    },
  }
}

describe('mentor-intelligence coverage', () => {
  it('marca taxonomy_missing quando não há pares mapeados', () => {
    const coverage = computeCoverageScore(10, [])
    expect(coverage.state).toBe('taxonomy_missing')
    expect(resolvePlanGenerationMode(coverage.state)).toBe('fallback_guided')
  })

  it('marca taxonomy_partial com cobertura abaixo do threshold', () => {
    const coverage = computeCoverageScore(10, [
      buildMapping('1', 'topic-a'),
      buildMapping('2', 'topic-b'),
    ])

    expect(coverage.state).toBe('taxonomy_partial')
    expect(resolvePlanGenerationMode(coverage.state)).toBe('hybrid')
  })

  it('marca ready com cobertura suficiente e tópicos distintos', () => {
    const coverage = computeCoverageScore(4, [
      buildMapping('1', 'topic-a'),
      buildMapping('2', 'topic-b'),
      buildMapping('3', 'topic-c'),
    ])

    expect(coverage.state).toBe('ready')
    expect(resolvePlanGenerationMode(coverage.state)).toBe('taxonomy_complete')
    expect(describePlanGenerationMode('taxonomy_complete')).toBe('Plano taxonômico completo')
  })
})

describe('mentor-intelligence taxonomy source', () => {
  it('deriva none quando não há mapping usado', () => {
    expect(resolveTaxonomySourceKind([])).toBe('none')
  })

  it('deriva homologation quando todos os mappings vêm do seed', () => {
    const mappings = [
      {
        ...buildMapping('1', 'topic-a'),
        sourceContext: 'homologation' as const,
      },
      {
        ...buildMapping('2', 'topic-b'),
        sourceContext: 'homologation' as const,
      },
    ]

    expect(resolveTaxonomySourceKind(mappings)).toBe('homologation')
  })

  it('deriva mixed quando mistura produção e homologação', () => {
    const mappings = [
      {
        ...buildMapping('1', 'topic-a'),
        sourceContext: 'production' as const,
      },
      {
        ...buildMapping('2', 'topic-b'),
        sourceContext: 'homologation' as const,
      },
    ]

    expect(resolveTaxonomySourceKind(mappings)).toBe('mixed')
  })
})

describe('mentor-intelligence status message', () => {
  it('descreve o plano híbrido de homologação com a mensagem nova', () => {
    expect(
      describeMentorPlanGeneration({
        generationMode: 'hybrid',
        taxonomySourceKind: 'homologation',
      }),
    ).toBe('Plano híbrido - homologação')
  })

  it('mantém cobertura parcial para híbrido misto', () => {
    expect(
      describeMentorPlanGeneration({
        generationMode: 'hybrid',
        taxonomySourceKind: 'mixed',
      }),
    ).toBe('Plano híbrido - cobertura parcial')
  })

  it('descreve taxonomia completa de homologação', () => {
    expect(
      describeMentorPlanGeneration({
        generationMode: 'taxonomy_complete',
        taxonomySourceKind: 'homologation',
      }),
    ).toBe('Plano taxonômico completo - homologação')
  })
})
