/**
 * Cliente para api.questoes.xtri.online — fonte unica de questoes ENEM
 * (2009-2025) que substitui o banco antigo question-bank-supabase nos
 * fluxos de geracao de listas/cadernos.
 *
 * Sem fallback: se a API falhar, o erro propaga (decisao PO 2026-05-01).
 *
 * Itens 2025 sem param_b sao filtrados pelo caller que precisa de TRI
 * (microdados ENEM 2025 ainda nao foram publicados pelo INEP).
 */

import type { AreaSigla } from '../types/report'
import type { QuestionCandidateRow, QuestionOptionRow } from './question-delivery'

const BASE_URL = 'https://api.questoes.xtri.online/api'
const TIMEOUT_MS = 10_000

// ---------------------------------------------------------------------------
// Tipos do schema da API (validados via curl em 2026-05-01)
// ---------------------------------------------------------------------------

export type ApiDiscipline =
  | 'linguagens'
  | 'matematica'
  | 'ciencias-humanas'
  | 'ciencias-natureza'

export type ApiLanguage = 'ingles' | 'espanhol' | null

export interface ApiSkill {
  readonly area: 'LC' | 'CH' | 'CN' | 'MT'
  readonly code: string // ex: 'H7'
  readonly label: string
}

export interface ApiAlternative {
  readonly letter: string
  readonly text: string
  readonly image: string | null
  readonly file: string | null
  readonly localFile: string | null
  readonly isCorrect: boolean
}

export interface ApiQuestion {
  readonly id: number
  readonly title: string
  readonly index: number
  readonly year: number
  readonly slug: string
  readonly discipline: ApiDiscipline
  readonly language: ApiLanguage
  readonly skill: ApiSkill | null
  readonly image: string | null
  readonly correctAlternative: string
  readonly param_b: number | null
  readonly param_a: number | null
  readonly param_c: number | null
  readonly in_item_aban: boolean
  // Campos so do detalhe (`/api/questions/{id}/`):
  readonly context?: string | null
  readonly contextLocal?: string | null
  readonly alternativesIntroduction?: string | null
  readonly alternatives?: ReadonlyArray<ApiAlternative>
  readonly files?: ReadonlyArray<unknown>
}

interface ApiPaginated<T> {
  readonly count: number
  readonly next: string | null
  readonly previous: string | null
  readonly results: ReadonlyArray<T>
}

// ---------------------------------------------------------------------------
// Mapeamentos area <-> discipline
// ---------------------------------------------------------------------------

export const AREA_TO_DISCIPLINE: Readonly<Record<AreaSigla, ApiDiscipline>> = {
  LC: 'linguagens',
  CH: 'ciencias-humanas',
  CN: 'ciencias-natureza',
  MT: 'matematica',
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) {
      throw new Error(`api.questoes.xtri.online ${r.status} em ${path}`)
    }
    return (await r.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Indices 1-5 do caderno ENEM sao linguagem estrangeira (LC) e tem 2 versoes
 * (Ingles e Espanhol). Quando o caller nao especifica, default = Ingles (95%+
 * dos alunos brasileiros). Caller pode passar 'espanhol' explicitamente ou
 * `null` para nao filtrar (devolvendo qualquer uma das 2).
 */
const DEFAULT_LC_LANGUAGE: ApiLanguage = 'ingles'

function resolveLanguageForIndex(
  index: number,
  language: ApiLanguage | undefined,
): ApiLanguage | null {
  if (language !== undefined) return language
  if (index >= 1 && index <= 5) return DEFAULT_LC_LANGUAGE
  return null
}

/**
 * Busca uma questao especifica pelo numero (index) na prova de um ano.
 * Quando `language` for fornecido, filtra entre Ingles/Espanhol (LC tem 2
 * versoes nas posicoes 1-5 da prova). Quando `language` for omitido, aplica
 * default (Ingles) para indices 1-5; demais indices nao precisam de filtro.
 *
 * Retorna null se nao achar.
 */
export async function fetchQuestionByYearIndex(
  year: number,
  index: number,
  language?: ApiLanguage,
): Promise<ApiQuestion | null> {
  const qs = new URLSearchParams({ index: String(index) })
  const effective = resolveLanguageForIndex(index, language)
  if (effective) qs.set('language', effective)
  const list = await apiGet<ApiPaginated<ApiQuestion>>(
    `/exams/${year}/questions/?${qs.toString()}`,
  )
  if (list.results && list.results.length > 0) {
    // O endpoint listing nao traz `context`, `alternatives` etc. — buscar detail.
    return await fetchQuestionDetail(list.results[0]!.id)
  }
  // Fallback: filtro pelo default (Ingles) pode dar 0 resultados em provas
  // antigas (ex: ENEM 2009 nao tinha Ingles/Espanhol como filtro). Caller
  // que passou language explicito recebe null direto; quem caiu no default
  // tenta de novo sem filtro.
  if (effective && language === undefined) {
    const fb = await apiGet<ApiPaginated<ApiQuestion>>(
      `/exams/${year}/questions/?index=${encodeURIComponent(String(index))}`,
    )
    if (fb.results && fb.results.length > 0) {
      return await fetchQuestionDetail(fb.results[0]!.id)
    }
  }
  return null
}

export async function fetchQuestionDetail(id: number): Promise<ApiQuestion> {
  return await apiGet<ApiQuestion>(`/questions/${id}/`)
}

/**
 * Busca em batch todas as questoes de uma lista de (year, index, language?).
 * Faz fetches em paralelo (Promise.all) — ~250ms por chamada, todas concorrentes.
 *
 * Resultado: array com a mesma ordem do input. `null` para items nao encontrados.
 */
export async function fetchQuestionsByYearIndexBatch(
  pairs: ReadonlyArray<{ year: number; index: number; language?: ApiLanguage }>,
): Promise<Array<ApiQuestion | null>> {
  return Promise.all(
    pairs.map((p) => fetchQuestionByYearIndex(p.year, p.index, p.language)),
  )
}

/**
 * Busca todas as questoes de uma disciplina em um ano (paginado).
 * Usado pelos fluxos topic + fallback que precisam buscar amplo.
 *
 * Cuidado: pode retornar 45-90 questoes por chamada. Se a API mudar
 * o tamanho da pagina, a paginacao continua funcionando via `next`.
 */
export async function fetchQuestionsByDiscipline(
  year: number,
  discipline: ApiDiscipline,
  options?: { language?: ApiLanguage | null; includeDetails?: boolean },
): Promise<ApiQuestion[]> {
  const qs = new URLSearchParams({ discipline })
  // Default Ingles para LC (alinhado com fetchQuestionByYearIndex). Caller
  // passa `null` explicito para desativar e receber as 2 versoes.
  const effectiveLang =
    options?.language !== undefined
      ? options.language
      : (discipline === 'linguagens' ? DEFAULT_LC_LANGUAGE : null)
  if (effectiveLang) qs.set('language', effectiveLang)
  let url: string | null = `/exams/${year}/questions/?${qs.toString()}`
  const collected: ApiQuestion[] = []
  while (url) {
    const page: ApiPaginated<ApiQuestion> = await apiGet(url)
    collected.push(...page.results)
    url = page.next
  }
  if (options?.includeDetails) {
    // Faz fetch de detail em paralelo para ter context+alternatives.
    const details = await Promise.all(
      collected.map((q) => fetchQuestionDetail(q.id)),
    )
    return details
  }
  return collected
}

// ---------------------------------------------------------------------------
// Adapters: ApiQuestion -> tipos legados (QuestionCandidateRow / QuestionOptionRow)
// Mantem a interface usada por chooseQuestionRows / resolveItem intacta.
// ---------------------------------------------------------------------------

/**
 * Converte param_b numerico (escala TRI ENEM ~ -3 a +3) em bucket textual
 * compativel com o `difficultyByBucket` ja usado em report-engine.ts.
 */
export function paramBToBucket(b: number | null | undefined): string | null {
  if (b == null) return null
  if (b < -1) return 'VERY_EASY'
  if (b < 0) return 'EASY'
  if (b < 1) return 'MEDIUM'
  if (b < 2) return 'HARD'
  return 'VERY_HARD'
}

export function mapApiToQuestionCandidate(q: ApiQuestion): QuestionCandidateRow {
  const sourceExamParts = [`ENEM ${q.year}`]
  if (q.language) sourceExamParts.push(q.language)
  return {
    id: String(q.id),
    source_year: q.year,
    source_question: q.index,
    source_exam: sourceExamParts.join(' '),
    stem: q.alternativesIntroduction ?? null,
    support_text: q.context ?? null,
    image_url: q.image,
    image_alt: null,
    difficulty: paramBToBucket(q.param_b),
    created_at: null,
  }
}

export function mapApiToOptions(q: ApiQuestion): QuestionOptionRow[] {
  if (!q.alternatives) return []
  return q.alternatives.map((a) => ({
    letter: a.letter,
    text: a.text,
    is_correct: a.isCorrect,
  }))
}

/**
 * Filtra questoes que nao podem ser usadas em recomendacoes baseadas em TRI:
 *   - `in_item_aban === true` (item abandonado pelo INEP, qualidade ruim)
 *   - `param_b` ausente quando `requireParamB=true` (ex: ENEM 2025 ainda
 *     sem microdados — opcao β acordada com PO em 2026-05-01)
 */
export function filterValidForTri(
  questions: ReadonlyArray<ApiQuestion>,
  options?: { requireParamB?: boolean },
): ApiQuestion[] {
  return questions.filter((q) => {
    if (q.in_item_aban) return false
    if (options?.requireParamB && q.param_b == null) return false
    return true
  })
}
