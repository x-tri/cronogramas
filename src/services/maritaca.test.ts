import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SimuladoResult } from '../types/supabase'

const sampleResult: SimuladoResult = {
  exam: {
    id: 'exam-1',
    title: 'Simulado Diagnóstico',
    answer_key: [],
    question_contents: null,
  },
  studentAnswer: {
    id: 'answer-1',
    exam_id: 'exam-1',
    student_number: '214140291',
    student_name: 'Aluno Teste',
    turma: '2A',
    answers: [],
    score: 102,
    correct_answers: 102,
    wrong_answers: 78,
    blank_answers: 0,
    tri_score: 565,
    tri_lc: 620,
    tri_ch: 590,
    tri_cn: 540,
    tri_mt: 510,
    created_at: new Date().toISOString(),
  },
  wrongQuestions: [
    { questionNumber: 12, topic: 'Interpretação de texto', studentAnswer: 'A', correctAnswer: 'B' },
    { questionNumber: 52, topic: 'Geopolítica', studentAnswer: 'C', correctAnswer: 'D' },
    { questionNumber: 101, topic: 'Genética', studentAnswer: 'E', correctAnswer: 'A' },
    { questionNumber: 150, topic: 'Função afim', studentAnswer: 'B', correctAnswer: 'C' },
  ],
  topicsSummary: [],
}

function mockJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  } as unknown as Response
}

describe('maritaca service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
  })

  afterEach(() => {
    import.meta.env.VITE_SUPABASE_URL = undefined
    vi.unstubAllGlobals()
  })

  async function loadService() {
    return import('./maritaca')
  }

  it('sends structured simulado payload to plano-estudo-generator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        estrategia: 'Plano detalhado.',
        diagnostico: {
          pontosFracos: ['Genética', 'Função afim'],
          pontosFortes: ['Leitura', 'Humanas'],
          metaProximoSimulado: 'Subir TRI em CN e MT.',
        },
        atividades: [
          {
            horario: '08:00-09:30',
            titulo: 'Ciências da Natureza - Genética',
            descricao: 'Revisar conceitos de genética e resolver questões do ENEM.',
            dica: 'Monte um quadro de cruzamentos.',
            prioridade: 'ALTA',
            area: 'cn',
          },
        ],
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { gerarPlanoEstudo } = await loadService()
    const plano = await gerarPlanoEstudo(sampleResult)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://test.supabase.co/functions/v1/plano-estudo-generator',
    )

    const request = fetchMock.mock.calls[0]?.[1] as { body: string }
    const payload = JSON.parse(request.body) as Record<string, unknown>

    expect(payload.studentName).toBe('Aluno Teste')
    expect(payload.turma).toBe('2A')
    expect(payload.examTitle).toBe('Simulado Diagnóstico')
    expect(payload.correctAnswers).toBe(102)
    expect(payload.wrongAnswers).toBe(78)
    expect(payload.tri).toEqual({ lc: 620, ch: 590, cn: 540, mt: 510 })
    expect(payload.topicsByArea).toEqual({
      lc: ['Interpretação de texto'],
      ch: ['Geopolítica'],
      cn: ['Genética'],
      mt: ['Função afim'],
    })
    expect(plano.estrategia).toBe('Plano detalhado.')
  })

  it('surfaces server-side generation failures without compact fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: 'Falha ao gerar plano detalhado',
          message: 'Etapa 2 falhou após as tentativas do lote',
        },
        500,
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { gerarPlanoEstudo } = await loadService()

    await expect(gerarPlanoEstudo(sampleResult)).rejects.toThrow(
      'Etapa 2 falhou após as tentativas do lote',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
