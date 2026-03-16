import { describe, expect, it, vi } from 'vitest'
import {
  orchestratePlanoEstudo,
  type CompletionRequest,
  type RequestCompletion,
} from './plano-estudo-generator'
import type { PlanoEstudoGeneratorInput } from './plano-estudo-shared'

const sampleInput: PlanoEstudoGeneratorInput = {
  studentName: 'Aluno Teste',
  turma: '2A',
  examTitle: 'Simulado Diagnóstico',
  correctAnswers: 102,
  wrongAnswers: 78,
  tri: {
    lc: 620,
    ch: 590,
    cn: 540,
    mt: 510,
  },
  topicsByArea: {
    lc: ['Interpretação de texto', 'Modernismo'],
    ch: ['Geopolítica', 'História do Brasil'],
    cn: ['Genética', 'Ecologia'],
    mt: ['Função afim', 'Probabilidade'],
  },
}

function createStageOneContent(activityCount = 8) {
  const horarios = [
    '08:00-09:30',
    '09:45-11:15',
    '13:00-14:30',
    '14:45-16:15',
    '17:15-18:15',
    '18:30-19:30',
    '19:45-20:45',
    '21:00-22:00',
  ]

  const atividades = horarios.slice(0, activityCount).map((horario, index) => ({
    horario,
    titulo: [
      'Ciências da Natureza - Genética',
      'Matemática - Probabilidade',
      'Ciências Humanas - História do Brasil',
      'Ciências Humanas - Exercícios de História',
      'Linguagens - Interpretação de Texto',
      'Matemática - Estatística',
      'Revisão - Genética e Probabilidade',
      'Autoavaliação e Planejamento',
    ][index],
    prioridade: index < 4 ? 'ALTA' : index < 6 ? 'MEDIA' : 'BAIXA',
    area: ['cn', 'mt', 'ch', 'ch', 'lc', 'mt', 'revisao', 'revisao'][index],
  }))

  return JSON.stringify({
    estrategia: 'Estratégia longa e detalhada para o dia completo, priorizando as áreas mais frágeis e alternando teoria, prática e revisão.',
    diagnostico: {
      pontosFracos: ['Genética (Natureza)', 'Probabilidade (Matemática)'],
      pontosFortes: ['Leitura e interpretação', 'Noções de Humanas'],
      metaProximoSimulado: 'Elevar CN para 560 e MT para 540 no próximo simulado.',
    },
    atividades,
  })
}

function createStageTwoContent(horarios: string[]) {
  return JSON.stringify({
    atividades: horarios.map((horario) => ({
      horario,
      descricao: `Descrição detalhada para ${horario}, com teoria, lista de questões, revisão dos erros e indicação de fonte.`,
      dica: `Dica específica para ${horario}.`,
    })),
  })
}

function matchBatchPrompt(prompt: string, horarios: [string, string]): boolean {
  return prompt.includes(`${horarios[0]} |`) && prompt.includes(`${horarios[1]} |`)
}

describe('plano-estudo-generator orchestration', () => {
  it('combines stage 1 and 4 detailed expansion batches into the final 10-block plan', async () => {
    const requestCompletion = vi.fn(async (request: CompletionRequest) => {
      if (request.prompt.includes('ETAPA 1 - PLANEJAMENTO BASE')) {
        return { content: createStageOneContent(), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['08:00-09:30', '09:45-11:15'])) {
        return { content: createStageTwoContent(['08:00-09:30', '09:45-11:15']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['13:00-14:30', '14:45-16:15'])) {
        return { content: createStageTwoContent(['13:00-14:30', '14:45-16:15']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['17:15-18:15', '18:30-19:30'])) {
        return { content: createStageTwoContent(['17:15-18:15', '18:30-19:30']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['19:45-20:45', '21:00-22:00'])) {
        return { content: createStageTwoContent(['19:45-20:45', '21:00-22:00']), finishReason: 'stop' }
      }

      throw new Error('Prompt não esperado no teste')
    }) satisfies RequestCompletion

    const plano = await orchestratePlanoEstudo(sampleInput, requestCompletion)

    expect(plano.atividades).toHaveLength(10)
    expect(plano.atividades.filter((activity) => activity.area === 'pausa')).toHaveLength(2)
    expect(plano.atividades[0]?.horario).toBe('08:00-09:30')
    expect(plano.atividades[2]?.horario).toBe('11:30-12:00')
    expect(plano.atividades[5]?.horario).toBe('16:30-17:00')
    expect(plano.atividades[0]?.descricao).toContain('teoria')
    expect(requestCompletion).toHaveBeenCalledTimes(5)
  })

  it('retries a detailed batch when the first expansion response is truncated', async () => {
    let firstBatchAttempts = 0

    const requestCompletion = vi.fn(async (request: CompletionRequest) => {
      if (request.prompt.includes('ETAPA 1 - PLANEJAMENTO BASE')) {
        return { content: createStageOneContent(), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['08:00-09:30', '09:45-11:15'])) {
        firstBatchAttempts += 1
        return firstBatchAttempts === 1
          ? { content: '{"atividades":[{"horario":"08:00-09:30"', finishReason: 'length' }
          : { content: createStageTwoContent(['08:00-09:30', '09:45-11:15']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['13:00-14:30', '14:45-16:15'])) {
        return { content: createStageTwoContent(['13:00-14:30', '14:45-16:15']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['17:15-18:15', '18:30-19:30'])) {
        return { content: createStageTwoContent(['17:15-18:15', '18:30-19:30']), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['19:45-20:45', '21:00-22:00'])) {
        return { content: createStageTwoContent(['19:45-20:45', '21:00-22:00']), finishReason: 'stop' }
      }

      throw new Error('Prompt não esperado no teste')
    }) satisfies RequestCompletion

    const plano = await orchestratePlanoEstudo(sampleInput, requestCompletion)

    expect(plano.atividades).toHaveLength(10)
    expect(firstBatchAttempts).toBe(2)
    expect(requestCompletion).toHaveBeenCalledTimes(6)
  })

  it('fails the whole orchestration when one detailed batch keeps failing after retries', async () => {
    const requestCompletion = vi.fn(async (request: CompletionRequest) => {
      if (request.prompt.includes('ETAPA 1 - PLANEJAMENTO BASE')) {
        return { content: createStageOneContent(), finishReason: 'stop' }
      }

      if (matchBatchPrompt(request.prompt, ['08:00-09:30', '09:45-11:15'])) {
        throw new Error('Lote 1 indisponível')
      }

      return {
        content: createStageTwoContent(['13:00-14:30', '14:45-16:15']),
        finishReason: 'stop',
      }
    }) satisfies RequestCompletion

    await expect(orchestratePlanoEstudo(sampleInput, requestCompletion)).rejects.toThrow(
      'Lote 1 indisponível',
    )
  })

  it('fails when stage 1 does not return the 8 expected study blocks', async () => {
    const requestCompletion = vi.fn(async (request: CompletionRequest) => {
      if (request.prompt.includes('ETAPA 1 - PLANEJAMENTO BASE')) {
        return { content: createStageOneContent(7), finishReason: 'stop' }
      }

      throw new Error('Etapa 2 não deveria ser chamada')
    }) satisfies RequestCompletion

    await expect(orchestratePlanoEstudo(sampleInput, requestCompletion)).rejects.toThrow(
      'Etapa 1 não retornou os 8 blocos de estudo esperados',
    )
    expect(requestCompletion).toHaveBeenCalledTimes(2)
  })
})
