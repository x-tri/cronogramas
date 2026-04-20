/**
 * Validacao de consistencia de um conjunto de itens do wizard (Fase 3.2).
 *
 * Reusado tanto pela planilha (edicao inline) quanto pelo fluxo de CSV.
 * Funcoes puras — sem IO.
 */

import type { SimuladoItemDraft } from './csv-parser.ts'
import { countByArea } from './csv-parser.ts'

export interface WizardMeta {
  readonly title: string
  readonly schoolId: string
  readonly turmas: readonly string[]
}

export type MetaIssue =
  | { kind: 'title_empty' }
  | { kind: 'title_too_long'; max: number }
  | { kind: 'school_required' }

/**
 * Valida meta-dados (Passo 1 do wizard).
 * turmas pode ser vazio (= todas) — nao ha issue para isso.
 */
export function validateMeta(meta: WizardMeta): readonly MetaIssue[] {
  const issues: MetaIssue[] = []
  const title = meta.title.trim()
  if (title.length === 0) issues.push({ kind: 'title_empty' })
  if (title.length > 120) issues.push({ kind: 'title_too_long', max: 120 })
  if (!meta.schoolId || meta.schoolId.trim().length === 0) {
    issues.push({ kind: 'school_required' })
  }
  return issues
}

export interface ItemsSummary {
  readonly total: number
  readonly byArea: Record<'LC' | 'CH' | 'CN' | 'MT', number>
  readonly missingAreas: ReadonlyArray<'LC' | 'CH' | 'CN' | 'MT'>
  readonly duplicateNumeros: readonly number[]
  readonly gaps: readonly number[]
  readonly isComplete: boolean
}

const EXPECTED_PER_AREA = 45
const TOTAL_ITEMS = 180
const AREAS: ReadonlyArray<'LC' | 'CH' | 'CN' | 'MT'> = ['LC', 'CH', 'CN', 'MT']

/**
 * Produz um resumo de completude e inconsistencias. Util para o dashboard
 * do wizard (ex: "45 LC, 44 CH, 45 CN, 0 MT — faltam 46").
 *
 * Nao lanca — retorna flags para a UI usar.
 */
export function summarizeItems(
  items: readonly SimuladoItemDraft[],
): ItemsSummary {
  const byArea = countByArea(items)
  const missingAreas = AREAS.filter((a) => byArea[a] < EXPECTED_PER_AREA)

  const seen = new Map<number, number>()
  const duplicates = new Set<number>()
  for (const it of items) {
    const prev = seen.get(it.numero)
    if (prev !== undefined) duplicates.add(it.numero)
    seen.set(it.numero, (prev ?? 0) + 1)
  }

  const gaps: number[] = []
  for (let n = 1; n <= TOTAL_ITEMS; n++) {
    if (!seen.has(n)) gaps.push(n)
  }

  const isComplete =
    items.length === TOTAL_ITEMS &&
    gaps.length === 0 &&
    duplicates.size === 0 &&
    AREAS.every((a) => byArea[a] === EXPECTED_PER_AREA)

  return {
    total: items.length,
    byArea,
    missingAreas,
    duplicateNumeros: [...duplicates].sort((a, b) => a - b),
    gaps,
    isComplete,
  }
}

/**
 * Verifica se pode submeter ao RPC: meta valido + itens completos + sem
 * duplicatas.
 */
export function canSubmit(
  meta: WizardMeta,
  items: readonly SimuladoItemDraft[],
): boolean {
  if (validateMeta(meta).length > 0) return false
  return summarizeItems(items).isComplete
}

/**
 * Formata um resumo de gaps para exibicao. Ex: "faltam 3 itens: 12, 40, 75".
 * Retorna string vazia se nao ha gaps.
 */
export function formatGapsMessage(gaps: readonly number[]): string {
  if (gaps.length === 0) return ''
  const sample = gaps.slice(0, 5).join(', ')
  const suffix = gaps.length > 5 ? `, ... (+${gaps.length - 5})` : ''
  return `faltam ${gaps.length} itens: ${sample}${suffix}`
}
