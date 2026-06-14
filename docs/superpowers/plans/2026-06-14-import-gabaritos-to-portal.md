# Importador gabaritos → portal — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar exames escaneados do gabaritos para o portal do aluno (simulado + itens + respostas), reutilizável por exame, validado e idempotente; primeira execução = Prova 1 da Marista.

**Architecture:** Módulo puro e testável (`import-from-gabaritos.ts`) que mapeia/valida dados, reaproveitando as funções puras que já geram os simulados digitados (`computeAreaBreakdown`, `answersMapToArray`, `groupErrorsByWithArea`, `areasRealizadasFromBreakdown`, `confidenceFromAreas`). TRI é **importado** do gabaritos (não recalculado). Um runner faz o I/O entre os dois projetos Supabase.

**Tech Stack:** TypeScript, Vitest, @supabase/supabase-js.

Spec: `docs/superpowers/specs/2026-06-14-import-gabaritos-to-portal-design.md`

---

## File Structure

- Create: `src/services/simulado/import-from-gabaritos.ts` — funções puras (tipos, validação, mapeamento, plano de import).
- Create: `src/services/simulado/import-from-gabaritos.test.ts` — testes unitários.
- Create: `scripts/import-exam-to-portal.ts` — runner I/O (lê gabaritos, escreve portal), `--dry-run`/`--only-matricula`.
- Reuse (sem modificar): `src/services/simulado/submit-simulado.ts` (`answersMapToArray`, `computeAreaBreakdown`), `tri-engine/engine.ts` (`groupErrorsByWithArea`), `item-audit.ts` (`areasRealizadasFromBreakdown`, `confidenceFromAreas`), `tri-engine/reference-tables.ts` (`AREAS`).

---

## Task 1: Tipos + `areaForNumero` + `validateExam`

**Files:**
- Create: `src/services/simulado/import-from-gabaritos.ts`
- Test: `src/services/simulado/import-from-gabaritos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { areaForNumero, validateExam, type GabaritosExam } from './import-from-gabaritos.ts'

function validKey(): string[] {
  // 180 letras A-E quaisquer, válidas
  return Array.from({ length: 180 }, (_, i) => 'ABCDE'[i % 5])
}
function examFixture(over: Partial<GabaritosExam> = {}): GabaritosExam {
  return { id: 'e1', title: 'Prova X', answer_key: validKey(), question_contents: null, ...over }
}

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts`
Expected: FAIL ("Cannot find module './import-from-gabaritos.ts'").

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/simulado/import-from-gabaritos.ts
import type { AreaKey } from './tri-engine/reference-tables.ts'

export interface GabaritosExam {
  readonly id: string
  readonly title: string
  readonly answer_key: readonly string[]
  readonly question_contents:
    | readonly { answer: string; content: string; questionNumber: number }[]
    | null
}

const TOTAL = 180
const LETTERS = new Set(['A', 'B', 'C', 'D', 'E'])

export function areaForNumero(numero: number): AreaKey {
  if (numero <= 45) return 'LC'
  if (numero <= 90) return 'CH'
  if (numero <= 135) return 'CN'
  return 'MT'
}

export function validateExam(exam: GabaritosExam): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!Array.isArray(exam.answer_key) || exam.answer_key.length !== TOTAL) {
    reasons.push(`answer_key deve ter 180 itens (tem ${exam.answer_key?.length ?? 0})`)
  } else {
    const bad = exam.answer_key.findIndex((k) => !LETTERS.has(String(k).toUpperCase().trim()))
    if (bad >= 0) reasons.push(`letra inválida no item ${bad + 1}: "${exam.answer_key[bad]}"`)
  }
  return { ok: reasons.length === 0, reasons }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts`
Expected: PASS (todos de Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/services/simulado/import-from-gabaritos.ts src/services/simulado/import-from-gabaritos.test.ts
git commit -m "feat(simulado): tipos + validateExam do importador gabaritos"
```

---

## Task 2: `buildItens`

**Files:**
- Modify: `src/services/simulado/import-from-gabaritos.ts`
- Test: `src/services/simulado/import-from-gabaritos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildItens, type SimuladoItemInsert } from './import-from-gabaritos.ts'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t buildItens`
Expected: FAIL ("buildItens is not a function").

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em import-from-gabaritos.ts

export interface SimuladoItemInsert {
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade: number
  readonly topico: string | null
  readonly habilidade: null
}

const DEFAULT_DIFICULDADE = 3 // placeholder NOT NULL (1-5); não afeta nota (TRI importado)

export function buildItens(exam: GabaritosExam): SimuladoItemInsert[] {
  const topicos = new Map<number, string>()
  for (const q of exam.question_contents ?? []) {
    if (typeof q?.content === 'string') topicos.set(q.questionNumber, q.content)
  }
  return Array.from({ length: TOTAL }, (_, i) => {
    const numero = i + 1
    return {
      numero,
      area: areaForNumero(numero),
      gabarito: String(exam.answer_key[i]).toUpperCase().trim(),
      dificuldade: DEFAULT_DIFICULDADE,
      topico: topicos.get(numero) ?? null,
      habilidade: null,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t buildItens`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/simulado/import-from-gabaritos.ts src/services/simulado/import-from-gabaritos.test.ts
git commit -m "feat(simulado): buildItens do importador gabaritos"
```

---

## Task 3: `buildResposta` (reaproveita motor de breakdown/erros)

**Files:**
- Modify: `src/services/simulado/import-from-gabaritos.ts`
- Test: `src/services/simulado/import-from-gabaritos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildResposta, buildItens as _bi, type GabaritosStudentAnswer } from './import-from-gabaritos.ts'

const ALL_BLANK = Array.from({ length: 180 }, () => '')

function saFixture(over: Partial<GabaritosStudentAnswer> = {}): GabaritosStudentAnswer {
  return {
    student_number: '123', student_name: 'X', turma: 'A',
    answers: ALL_BLANK, tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500, ...over,
  }
}

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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t buildResposta`
Expected: FAIL ("buildResposta is not a function").

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em import-from-gabaritos.ts
import { answersMapToArray, computeAreaBreakdown } from './submit-simulado.ts'
import { groupErrorsByWithArea } from './tri-engine/engine.ts'
import { areasRealizadasFromBreakdown, confidenceFromAreas } from './item-audit.ts'

export interface GabaritosStudentAnswer {
  readonly student_number: string
  readonly student_name: string
  readonly turma: string | null
  readonly answers: readonly string[]
  readonly tri_lc: number | null
  readonly tri_ch: number | null
  readonly tri_cn: number | null
  readonly tri_mt: number | null
}

export interface SimuladoRespostaInsert {
  readonly student_id: string
  readonly answers: Record<string, string>
  readonly tri_lc: number | null
  readonly tri_ch: number | null
  readonly tri_cn: number | null
  readonly tri_mt: number | null
  readonly acertos_lc: number; readonly erros_lc: number; readonly branco_lc: number
  readonly acertos_ch: number; readonly erros_ch: number; readonly branco_ch: number
  readonly acertos_cn: number; readonly erros_cn: number; readonly branco_cn: number
  readonly acertos_mt: number; readonly erros_mt: number; readonly branco_mt: number
  readonly erros_por_topico: Record<string, { area: AreaKey; n: number }>
  readonly erros_por_habilidade: Record<string, number>
  readonly areas_realizadas: AreaKey[]
  readonly confidence_level: 'high' | 'medium' | 'low' | 'invalid'
  readonly correction_status: 'computed'
  readonly tri_method: 'gabaritos_import'
  readonly tri_version: '1'
}

function triNaEscala(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v < 200 || v > 1000) return null
  return v
}

export function buildResposta(
  sa: GabaritosStudentAnswer,
  itens: readonly SimuladoItemInsert[],
  studentId: string,
): SimuladoRespostaInsert {
  // arrays na ordem 1..180
  const gabarito = itens.map((it) => it.gabarito)
  const topicos = itens.map((it) => it.topico)
  const areas = itens.map((it) => it.area)

  // mapa { "1": "A", ... } só com respostas válidas A-E
  const answersMap: Record<string, string> = {}
  for (let i = 0; i < TOTAL; i++) {
    const v = String(sa.answers[i] ?? '').toUpperCase().trim()
    if (LETTERS.has(v)) answersMap[String(i + 1)] = v
  }
  const answersArray = answersMapToArray(answersMap)

  const porArea = computeAreaBreakdown(answersArray, gabarito)
  const errosPorTopico = groupErrorsByWithArea(answersArray, gabarito, topicos, areas)

  return {
    student_id: studentId,
    answers: answersMap,
    tri_lc: triNaEscala(sa.tri_lc),
    tri_ch: triNaEscala(sa.tri_ch),
    tri_cn: triNaEscala(sa.tri_cn),
    tri_mt: triNaEscala(sa.tri_mt),
    acertos_lc: porArea.LC.acertos, erros_lc: porArea.LC.erros, branco_lc: porArea.LC.branco,
    acertos_ch: porArea.CH.acertos, erros_ch: porArea.CH.erros, branco_ch: porArea.CH.branco,
    acertos_cn: porArea.CN.acertos, erros_cn: porArea.CN.erros, branco_cn: porArea.CN.branco,
    acertos_mt: porArea.MT.acertos, erros_mt: porArea.MT.erros, branco_mt: porArea.MT.branco,
    erros_por_topico: errosPorTopico,
    erros_por_habilidade: {},
    areas_realizadas: areasRealizadasFromBreakdown(porArea),
    confidence_level: confidenceFromAreas(porArea),
    correction_status: 'computed',
    tri_method: 'gabaritos_import',
    tri_version: '1',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t buildResposta`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/simulado/import-from-gabaritos.ts src/services/simulado/import-from-gabaritos.test.ts
git commit -m "feat(simulado): buildResposta (TRI importado, breakdown reaproveitado)"
```

---

## Task 4: `matchByMatricula`

**Files:**
- Modify: `src/services/simulado/import-from-gabaritos.ts`
- Test: `src/services/simulado/import-from-gabaritos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { matchByMatricula } from './import-from-gabaritos.ts'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t matchByMatricula`
Expected: FAIL ("matchByMatricula is not a function").

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em import-from-gabaritos.ts
export function matchByMatricula(
  studentNumber: string,
  byMatricula: ReadonlyMap<string, string>,
): string | null {
  const raw = String(studentNumber ?? '').trim()
  if (byMatricula.has(raw)) return byMatricula.get(raw)!
  const norm = raw.replace(/^0+/, '') || '0'
  return byMatricula.get(norm) ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t matchByMatricula`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/simulado/import-from-gabaritos.ts src/services/simulado/import-from-gabaritos.test.ts
git commit -m "feat(simulado): matchByMatricula (exato + sem zeros à esquerda)"
```

---

## Task 5: `buildImportPlan` (orquestra puro)

**Files:**
- Modify: `src/services/simulado/import-from-gabaritos.ts`
- Test: `src/services/simulado/import-from-gabaritos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildImportPlan } from './import-from-gabaritos.ts'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts -t buildImportPlan`
Expected: FAIL ("buildImportPlan is not a function").

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em import-from-gabaritos.ts
export interface PortalStudent { readonly id: string; readonly matricula: string }

export interface ImportPlan {
  readonly ok: boolean
  readonly reasons: string[]
  readonly itens: SimuladoItemInsert[]
  readonly respostas: SimuladoRespostaInsert[]
  readonly unmatched: string[]
}

export function buildImportPlan(
  exam: GabaritosExam,
  studentAnswers: readonly GabaritosStudentAnswer[],
  portalStudents: readonly PortalStudent[],
): ImportPlan {
  const v = validateExam(exam)
  if (!v.ok) return { ok: false, reasons: v.reasons, itens: [], respostas: [], unmatched: [] }

  const itens = buildItens(exam)
  const byMat = new Map(portalStudents.map((s) => [s.matricula.trim(), s.id]))
  const respostas: SimuladoRespostaInsert[] = []
  const unmatched: string[] = []

  for (const sa of studentAnswers) {
    const id = matchByMatricula(sa.student_number, byMat)
    if (!id) { unmatched.push(sa.student_number); continue }
    respostas.push(buildResposta(sa, itens, id))
  }
  return { ok: true, reasons: [], itens, respostas, unmatched }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/simulado/import-from-gabaritos.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/services/simulado/import-from-gabaritos.ts src/services/simulado/import-from-gabaritos.test.ts
git commit -m "feat(simulado): buildImportPlan orquestrando o importador"
```

---

## Task 6: Runner `scripts/import-exam-to-portal.ts` (I/O + dry-run + idempotência)

**Files:**
- Create: `scripts/import-exam-to-portal.ts`

> Artefato reutilizável de operação. Lê o gabaritos e escreve o portal via service-role.
> Execução: `npx tsx scripts/import-exam-to-portal.ts --gabaritos-exam <id> --portal-school <id> [--title "..."] [--dry-run] [--only-matricula 214140291]`.
> Env: `PORTAL_SUPABASE_URL`, `PORTAL_SERVICE_ROLE_KEY`, `GABARITOS_SUPABASE_URL`, `GABARITOS_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Escrever o runner**

```ts
// scripts/import-exam-to-portal.ts
import { createClient } from '@supabase/supabase-js'
import {
  buildImportPlan, type GabaritosExam, type GabaritosStudentAnswer, type PortalStudent,
} from '../src/services/simulado/import-from-gabaritos.ts'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const has = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const examId = arg('gabaritos-exam')
  const schoolId = arg('portal-school')
  const onlyMat = arg('only-matricula')
  const dryRun = has('dry-run')
  if (!examId || !schoolId) throw new Error('use --gabaritos-exam <id> --portal-school <id>')

  const gab = createClient(process.env.GABARITOS_SUPABASE_URL!, process.env.GABARITOS_SERVICE_ROLE_KEY!)
  const portal = createClient(process.env.PORTAL_SUPABASE_URL!, process.env.PORTAL_SERVICE_ROLE_KEY!)

  const { data: exam } = await gab.from('exams')
    .select('id, title, answer_key, question_contents').eq('id', examId).single()
  let saQuery = gab.from('student_answers')
    .select('student_number, student_name, turma, answers, tri_lc, tri_ch, tri_cn, tri_mt')
    .eq('exam_id', examId)
  if (onlyMat) saQuery = saQuery.eq('student_number', onlyMat)
  const { data: sas } = await saQuery

  const { data: students } = await portal.from('students')
    .select('id, matricula').eq('school_id', schoolId)

  const plan = buildImportPlan(
    exam as GabaritosExam,
    (sas ?? []) as GabaritosStudentAnswer[],
    (students ?? []) as PortalStudent[],
  )
  if (!plan.ok) { console.error('Exame inválido:', plan.reasons); process.exit(1) }

  const title = arg('title') ?? (exam as GabaritosExam).title
  console.log(`Exame: ${title} | itens: ${plan.itens.length} | respostas: ${plan.respostas.length} | sem-match: ${plan.unmatched.length}`)
  if (plan.unmatched.length) console.log('Sem-match:', plan.unmatched.join(', '))

  if (dryRun) { console.log('[dry-run] nada escrito.'); return }

  // 1) find-or-create simulado (status closed)
  const existing = await portal.from('simulados')
    .select('id').eq('school_id', schoolId).eq('title', title).maybeSingle()
  let simuladoId = existing.data?.id as string | undefined
  if (!simuladoId) {
    const ins = await portal.from('simulados')
      .insert({ title, school_id: schoolId, status: 'closed', turmas: [] })
      .select('id').single()
    simuladoId = ins.data!.id
  }
  // 2) itens (idempotente)
  await portal.from('simulado_itens')
    .upsert(plan.itens.map((it) => ({ ...it, simulado_id: simuladoId })),
            { onConflict: 'simulado_id,numero', ignoreDuplicates: true })
  // 3) respostas (idempotente)
  await portal.from('simulado_respostas')
    .upsert(plan.respostas.map((r) => ({ ...r, simulado_id: simuladoId })),
            { onConflict: 'simulado_id,student_id', ignoreDuplicates: true })

  console.log(`OK. simulado_id=${simuladoId}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Verificar que compila / typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit` (ou o typecheck do projeto)
Expected: sem erros novos no arquivo do runner.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-exam-to-portal.ts
git commit -m "feat(scripts): runner import-exam-to-portal (dry-run + idempotente)"
```

---

## Task 7: Primeira execução — Prova 1 (Marista), via MCP, com gate

> Execução operacional desta sessão (Abordagem C). Escrita em produção **só após** aprovação do dry-run.
> `exam_id=4c57585f-fc25-4a41-bcaf-c252578aff46`, `school_id=50c6894c-f97d-482f-b208-c8c35d3adea3`.

- [ ] **Step 1: Dry-run / validação do plano (gate da Nicole)**

Computar o `ImportPlan` com os dados reais (exame + student_answers do gabaritos + students do portal, obtidos via MCP) usando as funções puras, e **validar**:
- a resposta da Nicole (`214140291`): `acertos_lc+ch+cn+mt === 48` e `tri == {lc:534.3, ch:400.1, cn:498.3, mt:465.1}`;
- total de `respostas` ≈ 176 e listar `unmatched`.

Se a Nicole não der 48 acertos contra o gabarito da Prova 1, **abortar**.

- [ ] **Step 2: Aprovação do usuário para escrever**

Apresentar o resumo (importáveis / sem-match / amostra Nicole). Prosseguir só com "ok".

- [ ] **Step 3: Escrever em produção (idempotente)**

Criar o `simulado` ("Prova 1 (Simulado 1)", school 50c6894c, status `closed`), inserir 180 `simulado_itens`, inserir as ~176 `simulado_respostas` — com `ON CONFLICT DO NOTHING`.

- [ ] **Step 4: Verificar**

```sql
-- linha da Nicole criada e consistente
select r.acertos_lc+r.acertos_ch+r.acertos_cn+r.acertos_mt as acertos,
       r.tri_lc, r.tri_ch, r.tri_cn, r.tri_mt
from public.simulado_respostas r
join public.students s on s.id = r.student_id
join public.simulados sim on sim.id = r.simulado_id
where s.matricula='214140291' and sim.title='Prova 1 (Simulado 1)';
-- esperado: acertos=48, tri 534.3/400.1/498.3/465.1
```

E, se possível, abrir a tela de resultado da Nicole no preview e confirmar visualmente.

- [ ] **Step 5: Commit (artefatos) / atualizar memória**

Commitar spec + plano + módulo já foi feito nas tasks anteriores; registrar na memória que a Prova 1 da Marista foi importada (data 2026-06-14, simulado_id).

---

## Self-Review

- **Cobertura da spec:** validateExam (T1), buildItens (T2), buildResposta+TRI importado+invariante 45 (T3), matchByMatricula (T4), buildImportPlan+unmatched (T5), runner idempotente+dry-run (T6), 1ª execução Prova 1+gate Nicole+verificação (T7). ✔
- **Placeholders:** nenhum "TBD"; todo passo tem código/SQL/comando concreto. ✔
- **Consistência de tipos:** `GabaritosExam`, `SimuladoItemInsert`, `GabaritosStudentAnswer`, `SimuladoRespostaInsert`, `PortalStudent`, `ImportPlan` usados de forma idêntica entre tasks; `buildResposta(sa, itens, studentId)` mesma assinatura em T3/T5/T6. ✔
- **Reuso (DRY):** `answersMapToArray`, `computeAreaBreakdown`, `groupErrorsByWithArea`, `areasRealizadasFromBreakdown`, `confidenceFromAreas` — assinaturas verificadas no código real. ✔
