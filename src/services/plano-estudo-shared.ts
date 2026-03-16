import type { SimuladoResult } from '../types/supabase.ts'

export interface Atividade {
  horario: string
  titulo: string
  descricao: string
  dica: string
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'
  area: 'cn' | 'ch' | 'lc' | 'mt' | 'revisao' | 'pausa'
}

export interface Diagnostico {
  pontosFracos: string[]
  pontosFortes: string[]
  metaProximoSimulado: string
}

export interface PlanoEstudo {
  estrategia: string
  diagnostico: Diagnostico
  atividades: Atividade[]
}

export interface PlanoEstudoGeneratorInput {
  studentName: string
  turma: string | null
  examTitle: string
  correctAnswers: number
  wrongAnswers: number
  tri: {
    lc: number | null
    ch: number | null
    cn: number | null
    mt: number | null
  }
  topicsByArea: {
    lc: string[]
    ch: string[]
    cn: string[]
    mt: string[]
  }
}

export const STUDY_ACTIVITY_SLOTS = [
  '08:00-09:30',
  '09:45-11:15',
  '13:00-14:30',
  '14:45-16:15',
  '17:15-18:15',
  '18:30-19:30',
  '19:45-20:45',
  '21:00-22:00',
] as const

export const FIXED_PAUSE_ACTIVITIES: Atividade[] = [
  {
    horario: '11:30-12:00',
    titulo: 'Pausa Estratégica',
    descricao: 'Levante-se, alongue, beba água e faça respiração profunda por 10 minutos.',
    dica: 'Evite telas nesta pausa para recarregar o cérebro.',
    prioridade: 'BAIXA',
    area: 'pausa',
  },
  {
    horario: '16:30-17:00',
    titulo: 'Pausa Estratégica',
    descricao: 'Descanse, coma algo leve e caminhe por 5 minutos.',
    dica: 'Use o tempo para ouvir um podcast educativo rápido sobre atualidades.',
    prioridade: 'BAIXA',
    area: 'pausa',
  },
] as const

const FULL_DAY_SCHEDULE = [
  STUDY_ACTIVITY_SLOTS[0],
  STUDY_ACTIVITY_SLOTS[1],
  FIXED_PAUSE_ACTIVITIES[0].horario,
  STUDY_ACTIVITY_SLOTS[2],
  STUDY_ACTIVITY_SLOTS[3],
  FIXED_PAUSE_ACTIVITIES[1].horario,
  STUDY_ACTIVITY_SLOTS[4],
  STUDY_ACTIVITY_SLOTS[5],
  STUDY_ACTIVITY_SLOTS[6],
  STUDY_ACTIVITY_SLOTS[7],
] as const

function uniqueTopics(topics: Array<string | null | undefined>, maxItems: number): string[] {
  return Array.from(
    new Set(
      topics
        .map((topic) => (typeof topic === 'string' ? topic.trim() : ''))
        .filter(Boolean),
    ),
  ).slice(0, maxItems)
}

function byQuestionRange(result: SimuladoResult, start: number, end: number): string[] {
  return uniqueTopics(
    result.wrongQuestions
      .filter((question) => question.questionNumber >= start && question.questionNumber <= end)
      .map((question) => question.topic),
    6,
  )
}

export function buildPlanoEstudoGeneratorInput(result: SimuladoResult): PlanoEstudoGeneratorInput {
  return {
    studentName: result.studentAnswer.student_name ?? 'Aluno(a)',
    turma: result.studentAnswer.turma ?? null,
    examTitle: result.exam.title,
    correctAnswers: result.studentAnswer.correct_answers,
    wrongAnswers: result.studentAnswer.wrong_answers,
    tri: {
      lc: result.studentAnswer.tri_lc,
      ch: result.studentAnswer.tri_ch,
      cn: result.studentAnswer.tri_cn,
      mt: result.studentAnswer.tri_mt,
    },
    topicsByArea: {
      lc: byQuestionRange(result, 1, 45),
      ch: byQuestionRange(result, 46, 90),
      cn: byQuestionRange(result, 91, 135),
      mt: byQuestionRange(result, 136, 180),
    },
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parsePlanoEstudoGeneratorInput(value: unknown): PlanoEstudoGeneratorInput {
  if (!value || typeof value !== 'object') {
    throw new Error('Payload inválido para geração do plano')
  }

  const payload = value as Record<string, unknown>
  const tri = (payload.tri ?? {}) as Record<string, unknown>
  const topicsByArea = (payload.topicsByArea ?? {}) as Record<string, unknown>

  const input: PlanoEstudoGeneratorInput = {
    studentName: normalizeText(payload.studentName, 'Aluno(a)'),
    turma: normalizeText(payload.turma) || null,
    examTitle: normalizeText(payload.examTitle, 'Simulado'),
    correctAnswers: typeof payload.correctAnswers === 'number' ? payload.correctAnswers : 0,
    wrongAnswers: typeof payload.wrongAnswers === 'number' ? payload.wrongAnswers : 0,
    tri: {
      lc: normalizeNumber(tri.lc),
      ch: normalizeNumber(tri.ch),
      cn: normalizeNumber(tri.cn),
      mt: normalizeNumber(tri.mt),
    },
    topicsByArea: {
      lc: Array.isArray(topicsByArea.lc) ? uniqueTopics(topicsByArea.lc as Array<string | null | undefined>, 6) : [],
      ch: Array.isArray(topicsByArea.ch) ? uniqueTopics(topicsByArea.ch as Array<string | null | undefined>, 6) : [],
      cn: Array.isArray(topicsByArea.cn) ? uniqueTopics(topicsByArea.cn as Array<string | null | undefined>, 6) : [],
      mt: Array.isArray(topicsByArea.mt) ? uniqueTopics(topicsByArea.mt as Array<string | null | undefined>, 6) : [],
    },
  }

  if (!input.studentName || !input.examTitle) {
    throw new Error('Payload inválido para geração do plano')
  }

  return input
}

export function normalizeList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeText(item))
      .filter(Boolean)

    return normalized.length ? normalized : fallback
  }

  const text = normalizeText(value)
  if (!text) return fallback

  return text
    .split(/[,;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function simplifyText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export function normalizePriority(value: unknown): Atividade['prioridade'] {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (normalized.includes('ALTA') || normalized.includes('HIGH')) return 'ALTA'
  if (normalized.includes('MEDIA') || normalized.includes('MEDIUM')) return 'MEDIA'
  return 'BAIXA'
}

function detectArea(value: string): Atividade['area'] | null {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (!normalized) return null
  if (normalized === 'cn' || normalized.includes('natureza') || normalized.includes('quim') || normalized.includes('fis') || normalized.includes('bio')) return 'cn'
  if (normalized === 'ch' || normalized.includes('human') || normalized.includes('hist') || normalized.includes('geo') || normalized.includes('filo') || normalized.includes('socio')) return 'ch'
  if (normalized === 'lc' || normalized.includes('ling') || normalized.includes('port') || normalized.includes('reda') || normalized.includes('texto') || normalized.includes('ingles')) return 'lc'
  if (normalized === 'mt' || normalized.includes('mat') || normalized.includes('geometr') || normalized.includes('algebra') || normalized.includes('probab') || normalized.includes('func')) return 'mt'
  if (normalized.includes('revis')) return 'revisao'
  if (normalized.includes('pausa') || normalized.includes('intervalo') || normalized.includes('descanso')) return 'pausa'

  return null
}

export function normalizeArea(value: unknown, title: string): Atividade['area'] {
  return detectArea(normalizeText(value)) ?? detectArea(title) ?? 'revisao'
}

export function stripCodeFences(content: string): string {
  return content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function normalizeActivities(value: unknown): Atividade[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, index) => {
      const titulo = simplifyText(normalizeText(item.titulo, `Atividade ${index + 1}`), 140)
      const descricao = simplifyText(
        normalizeText(item.descricao, 'Revisar os pontos principais do conteúdo e praticar questões.'),
        2_000,
      )
      const area = normalizeArea(item.area, titulo)

      return {
        horario: normalizeText(item.horario, `${8 + index * 2}:00`),
        titulo,
        descricao,
        dica: simplifyText(
          normalizeText(
            item.dica,
            area === 'pausa'
              ? 'Respire e recupere o foco.'
              : 'Mantenha constância e registre os erros.',
          ),
          400,
        ),
        prioridade: area === 'pausa' ? 'BAIXA' : normalizePriority(item.prioridade),
        area,
      } satisfies Atividade
    })
}

export function combineStudyActivitiesWithPauses(studyActivities: Atividade[]): Atividade[] {
  const studyBySlot = new Map(studyActivities.map((activity) => [activity.horario, activity]))
  const pausesBySlot = new Map(FIXED_PAUSE_ACTIVITIES.map((activity) => [activity.horario, activity]))

  return FULL_DAY_SCHEDULE
    .map((horario) => studyBySlot.get(horario) ?? pausesBySlot.get(horario))
    .filter((activity): activity is Atividade => Boolean(activity))
}

export function normalizePlanoEstudo(value: unknown): PlanoEstudo {
  if (!value || typeof value !== 'object') {
    throw new Error('Plano de estudo inválido')
  }

  const payload = value as Record<string, unknown>
  const diagnostico = (payload.diagnostico ?? {}) as Record<string, unknown>
  const atividadesRaw = Array.isArray(payload.atividades)
    ? payload.atividades
    : Array.isArray((payload.plano as Record<string, unknown> | undefined)?.atividades)
      ? (payload.plano as Record<string, unknown>).atividades
      : []

  const atividades = normalizeActivities(atividadesRaw)
  if (!atividades.length) {
    throw new Error('Plano de estudo inválido')
  }

  return {
    estrategia: simplifyText(
      normalizeText(
        payload.estrategia,
        'Priorize as áreas de menor TRI com ciclos de teoria, prática e revisão.',
      ),
      3_000,
    ),
    diagnostico: {
      pontosFracos: normalizeList(diagnostico.pontosFracos, ['Matemática', 'Ciências da Natureza']),
      pontosFortes: normalizeList(diagnostico.pontosFortes, ['Linguagens', 'Humanas']),
      metaProximoSimulado: simplifyText(
        normalizeText(
          diagnostico.metaProximoSimulado,
          'Elevar os acertos nas áreas prioritárias no próximo simulado.',
        ),
        500,
      ),
    },
    atividades,
  }
}
