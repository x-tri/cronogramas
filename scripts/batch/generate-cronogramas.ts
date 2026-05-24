/**
 * Geração em lote de cronogramas + PDFs para uma school+projeto+semana
 * arbitrários. Substitui o antigo generate-integrado-cronogramas.ts, agora
 * realmente parametrizável.
 *
 * Execução:
 *   npx vite-node scripts/batch/generate-cronogramas.ts -- \
 *     --school-id=<uuid> --project-id=<uuid> --week-start=YYYY-MM-DD \
 *     --stage=plan|persist|pdf [--limit=N]
 *
 * Descoberta de projetos disponíveis (separate mode):
 *   npx vite-node scripts/batch/generate-cronogramas.ts -- \
 *     --list-projects --school-id=<uuid>
 *
 * Constraints do produto (definidas pelo coordenador):
 *   - Tópicos duplicados (genética, genética, genética -> 1 bloco)
 *   - Dias úteis (seg-sex): apenas turnos tarde + noite
 *   - Fim de semana (sáb-dom): livre (manhã + tarde + noite)
 *
 * Pré-req: supabase CLI autenticado (via keyring local OU
 * SUPABASE_ACCESS_TOKEN env).
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  fetchProjetoData,
  fetchSchoolInfo,
  linkProject,
  listAllSchools,
  listProjectsForSchool,
  type ProjectInfo,
  type ProjetoData,
  type SchoolInfo,
} from './lib/fetch-projeto'
import {
  extractWrongQuestions,
  dedupTopics,
  type DedupedTopic,
} from './lib/topic-extraction'
import { buildSchedulableSlots, summarizeSlots } from './lib/slot-builder'
import {
  distributeTopicsToSlots,
  type ScheduledBlock,
} from './lib/distribute'
import { renderCronograma, sanitizeForFilename } from './lib/render-pdf'
import { persistAluno } from './lib/persist'
import type { ProjetoStudent } from '../../src/lib/contracts/gabarito-scanner'

// ----- Constantes não-parametrizáveis ----------------------------------------

const PRIMARY_REF = 'comwcnmvnuzqqbypjtqn'
const SIMULADO_REF = 'axtmozyrnsrhqrnktshz'
const SCRIPT_DIR = resolve(import.meta.dirname ?? __dirname)
const OUT_DIR = resolve(SCRIPT_DIR, 'out')

// ----- Tipos do plano --------------------------------------------------------

interface AreaSummary {
  readonly area: 'LC' | 'CH' | 'CN' | 'MT'
  readonly label: string
  readonly acertos: number
  readonly erros: number
  readonly brancos: number
}

interface AlunoPlan {
  readonly matricula: string
  readonly studentName: string | null
  readonly turma: string | null
  readonly wrongQuestionsCount: number
  readonly uniqueTopicsCount: number
  readonly scheduledBlocks: readonly ScheduledBlock[]
  readonly droppedTopics: readonly DedupedTopic[]
  readonly areaSummaries: readonly AreaSummary[]
}

interface BatchPlan {
  readonly meta: {
    readonly schoolId: string
    readonly schoolName: string
    readonly schoolSlug: string
    readonly projectId: string
    readonly projectName: string
    readonly weekStart: string
    readonly weekEnd: string
    readonly generatedAt: string
  }
  readonly stats: {
    readonly totalAlunos: number
    readonly alunosComBlocos: number
    readonly alunosSemErros: number
    readonly totalBlocos: number
    readonly slotsDisponiveisPorAluno: number
  }
  readonly alunos: readonly AlunoPlan[]
}

interface RunConfig {
  readonly schoolId: string
  readonly projectId: string
  readonly weekStart: string
  readonly weekEnd: string
}

// ----- Helpers de path -------------------------------------------------------

function planFile(schoolSlug: string, weekStart: string): string {
  return resolve(SCRIPT_DIR, `.generated_plan_${schoolSlug}_${weekStart}.json`)
}

function zipPath(schoolSlug: string, weekStart: string): string {
  return resolve(OUT_DIR, `cronogramas-${schoolSlug}-${weekStart}.zip`)
}

function outDirForRun(schoolSlug: string, weekStart: string): string {
  return resolve(OUT_DIR, `${schoolSlug}-${weekStart}`)
}

// ----- Pipeline por aluno (idêntico ao antes) --------------------------------

function buildAreaSummaries(student: ProjetoStudent): readonly AreaSummary[] {
  const areaCorrect = student.areaCorrectAnswers ?? {}
  const result: AreaSummary[] = []
  const labels = { LC: 'Linguagens', CH: 'Humanas', CN: 'Natureza', MT: 'Matemática' } as const
  for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
    const acertos = (areaCorrect as Record<string, number>)[area] ?? 0
    const erros = Math.max(0, 45 - acertos)
    const brancos = 0
    result.push({ area, label: labels[area], acertos, erros, brancos })
  }
  return result
}

function planForStudent(
  student: ProjetoStudent,
  answerKey: readonly string[],
  slots: ReturnType<typeof buildSchedulableSlots>,
): AlunoPlan {
  const matricula =
    student.studentNumber ?? student.matricula ?? student.student_number ?? ''
  const studentName = student.studentName ?? student.name ?? student.nome ?? null
  const wrong = extractWrongQuestions(student.answers, answerKey)
  const topics = dedupTopics(wrong)
  const { scheduled, dropped } = distributeTopicsToSlots(topics, slots)
  const areaSummaries = buildAreaSummaries(student)
  return {
    matricula,
    studentName,
    turma: student.turma ?? null,
    wrongQuestionsCount: wrong.length,
    uniqueTopicsCount: topics.length,
    scheduledBlocks: scheduled,
    droppedTopics: dropped,
    areaSummaries,
  }
}

// ----- Stage 2: PLAN (read-only) --------------------------------------------

function runPlanStage(cfg: RunConfig): BatchPlan {
  console.log(`\n[plan] semana ${cfg.weekStart} → ${cfg.weekEnd}, school=${cfg.schoolId.slice(0, 8)}…\n`)

  console.log(`[plan] link SIMULADO + lookup school e projeto`)
  linkProject(SIMULADO_REF)
  const school: SchoolInfo = fetchSchoolInfo(cfg.schoolId)
  console.log(`[plan] school: "${school.name}" (slug=${school.slug})`)

  const projeto: ProjetoData = fetchProjetoData({
    projectId: cfg.projectId,
    schoolId: cfg.schoolId,
  })
  console.log(
    `[plan] projeto: "${projeto.projectName}"  answer_key.length=${projeto.answerKey.length}  students=${projeto.students.length}`,
  )

  const slots = buildSchedulableSlots()
  const slotSummary = summarizeSlots(slots)
  console.log(
    `[plan] slots disponíveis/aluno: ${slotSummary.total} (${slotSummary.byTurno.manha} manhã | ${slotSummary.byTurno.tarde} tarde | ${slotSummary.byTurno.noite} noite)`,
  )

  const alunos: AlunoPlan[] = projeto.students.map((s) =>
    planForStudent(s, projeto.answerKey, slots),
  )

  const alunosComBlocos = alunos.filter((a) => a.scheduledBlocks.length > 0).length
  const alunosSemErros = alunos.filter((a) => a.wrongQuestionsCount === 0).length
  const totalBlocos = alunos.reduce((sum, a) => sum + a.scheduledBlocks.length, 0)

  const plan: BatchPlan = {
    meta: {
      schoolId: cfg.schoolId,
      schoolName: school.name,
      schoolSlug: school.slug,
      projectId: cfg.projectId,
      projectName: projeto.projectName,
      weekStart: cfg.weekStart,
      weekEnd: cfg.weekEnd,
      generatedAt: new Date().toISOString(),
    },
    stats: {
      totalAlunos: alunos.length,
      alunosComBlocos,
      alunosSemErros,
      totalBlocos,
      slotsDisponiveisPorAluno: slotSummary.total,
    },
    alunos,
  }

  printPlanReport(plan)
  const out = planFile(school.slug, cfg.weekStart)
  writeFileSync(out, JSON.stringify(plan, null, 2))
  console.log(`\n[plan] salvo em ${out}`)
  console.log(`[plan] arquivo contém PII (matricula/nomes) — protegido por .gitignore`)
  return plan
}

function printPlanReport(plan: BatchPlan): void {
  const { stats, alunos, meta } = plan
  console.log(`\n  =============================================`)
  console.log(`  RESUMO DO PLANO (read-only — nada foi escrito)`)
  console.log(`  =============================================`)
  console.log(`  School:                           ${meta.schoolName}`)
  console.log(`  Projeto:                          ${meta.projectName}`)
  console.log(`  Semana:                           ${meta.weekStart} → ${meta.weekEnd}`)
  console.log(`  Total de alunos no projeto:       ${stats.totalAlunos}`)
  console.log(`  Alunos com blocos a distribuir:   ${stats.alunosComBlocos}`)
  console.log(`  Alunos sem erros (skip):          ${stats.alunosSemErros}`)
  console.log(`  Total de blocos a criar:          ${stats.totalBlocos}`)
  console.log(`  Slots disponíveis/aluno:          ${stats.slotsDisponiveisPorAluno}`)
  console.log(``)

  const buckets = { '0': 0, '1-5': 0, '6-10': 0, '11-20': 0, '21+': 0 }
  for (const a of alunos) {
    const n = a.uniqueTopicsCount
    if (n === 0) buckets['0']++
    else if (n <= 5) buckets['1-5']++
    else if (n <= 10) buckets['6-10']++
    else if (n <= 20) buckets['11-20']++
    else buckets['21+']++
  }
  console.log(`  Distribuição de tópicos únicos por aluno:`)
  for (const [bucket, count] of Object.entries(buckets)) {
    console.log(`    ${bucket.padStart(8)}: ${count} alunos`)
  }

  const drops = alunos.filter((a) => a.droppedTopics.length > 0)
  if (drops.length > 0) {
    console.log(``)
    console.log(`  Atenção: ${drops.length} alunos têm mais tópicos que slots (slots=${stats.slotsDisponiveisPorAluno})`)
    for (const a of drops.slice(0, 5)) {
      console.log(`    matricula=${a.matricula} unique=${a.uniqueTopicsCount} dropped=${a.droppedTopics.length}`)
    }
  }
}

// ----- Stage 3: PERSIST (writes em PRIMARY) ----------------------------------

function loadPlanOrThrow(cfg: RunConfig): BatchPlan {
  // Tenta resolver via metadata armazenada. Precisa do schoolSlug que NÃO está
  // em cfg → faz lookup primeiro? Simplificamos: o plan já contém schoolSlug,
  // então não precisamos saber antes. Usamos um filename baseado em schoolId+week
  // como fallback E procuramos o que existe.
  // Simpler: tentamos os formatos conhecidos.
  // Mas como sabemos o schoolSlug? Olhamos por arquivos que batem com a
  // weekStart e schoolId no metadata.
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const candidates = fs
    .readdirSync(SCRIPT_DIR)
    .filter((f) => f.startsWith('.generated_plan_') && f.endsWith('.json'))
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(SCRIPT_DIR, c), 'utf-8'),
      ) as BatchPlan
      if (
        parsed.meta.schoolId === cfg.schoolId &&
        parsed.meta.projectId === cfg.projectId &&
        parsed.meta.weekStart === cfg.weekStart
      ) {
        return parsed
      }
    } catch {
      /* ignora arquivos corrompidos/parciais */
    }
  }
  throw new Error(
    `plan não encontrado para (school=${cfg.schoolId.slice(0, 8)}, project=${cfg.projectId.slice(0, 8)}, week=${cfg.weekStart}). Rode primeiro: --stage=plan`,
  )
}

function runPersistStage(cfg: RunConfig, limit?: number): void {
  const plan = loadPlanOrThrow(cfg)
  const alunos = limit ? plan.alunos.slice(0, limit) : plan.alunos
  console.log(`\n[persist] school: ${plan.meta.schoolName}`)
  console.log(`[persist] linkar PRIMARY para escrever cronograma + blocos`)
  linkProject(PRIMARY_REF)
  if (limit) {
    console.log(`[persist] MODO LIMITADO: rodando apenas ${limit}/${plan.alunos.length} alunos`)
  }
  console.log(`[persist] ${alunos.length} alunos a processar`)
  console.log(`[persist] política: SKIP se cronograma já existir para (matricula, semana_inicio=${plan.meta.weekStart})`)
  console.log(``)

  const counts = { created: 0, skipped: 0, failed: 0, empty: 0 }
  let totalBlocos = 0
  const failures: Array<{ matricula: string; reason: string }> = []

  for (let i = 0; i < alunos.length; i++) {
    const aluno = alunos[i]
    const result = persistAluno(
      {
        matricula: aluno.matricula,
        studentName: aluno.studentName,
        scheduledBlocks: aluno.scheduledBlocks,
      },
      { weekStart: plan.meta.weekStart, weekEnd: plan.meta.weekEnd },
    )
    counts[result.result] += 1
    if (result.result === 'created') totalBlocos += result.blocosCriados ?? 0
    if (result.result === 'failed') {
      failures.push({ matricula: aluno.matricula, reason: result.reason ?? 'unknown' })
    }
    if ((i + 1) % 5 === 0 || alunos.length <= 3) {
      console.log(
        `[persist]   ${i + 1}/${alunos.length} (created=${counts.created} skipped=${counts.skipped} failed=${counts.failed})`,
      )
    }
  }

  console.log(`\n  =============================================`)
  console.log(`  RESUMO PERSIST`)
  console.log(`  =============================================`)
  console.log(`  Cronogramas criados:  ${counts.created}`)
  console.log(`  Cronogramas skipped:  ${counts.skipped} (já existiam)`)
  console.log(`  Cronogramas vazios:   ${counts.empty} (sem erros no simulado)`)
  console.log(`  Falhas:               ${counts.failed}`)
  console.log(`  Total blocos criados: ${totalBlocos}`)

  if (failures.length > 0) {
    console.log(`\n  Detalhes das falhas:`)
    for (const f of failures) {
      console.log(`    matricula=${f.matricula}: ${f.reason}`)
    }
    process.exit(1)
  }
}

// ----- Stage 4: PDF (render + zip) -------------------------------------------

async function runPdfStage(cfg: RunConfig): Promise<void> {
  const plan = loadPlanOrThrow(cfg)
  const alunoOutDir = outDirForRun(plan.meta.schoolSlug, plan.meta.weekStart)
  const outZip = zipPath(plan.meta.schoolSlug, plan.meta.weekStart)

  console.log(`\n[pdf] school: ${plan.meta.schoolName}`)
  console.log(`[pdf] ${plan.alunos.length} alunos para renderizar`)

  if (existsSync(alunoOutDir)) rmSync(alunoOutDir, { recursive: true, force: true })
  mkdirSync(alunoOutDir, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const nameCount = new Map<string, number>()
  for (const a of plan.alunos) {
    const name = sanitizeForFilename(a.studentName, a.matricula)
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1)
  }
  const duplicateNames = new Set(
    Array.from(nameCount.entries())
      .filter(([, c]) => c > 1)
      .map(([n]) => n),
  )

  let done = 0
  let failed = 0
  for (const aluno of plan.alunos) {
    const sanitized = sanitizeForFilename(aluno.studentName, aluno.matricula)
    const filename = duplicateNames.has(sanitized)
      ? `${sanitized}-${aluno.matricula.replace(/[^a-zA-Z0-9_\-.]/g, '_')}.pdf`
      : `${sanitized}.pdf`
    const outFilePath = `${alunoOutDir}/${filename}`
    try {
      await renderCronograma(
        {
          matricula: aluno.matricula,
          studentName: aluno.studentName,
          turma: aluno.turma,
          scheduledBlocks: aluno.scheduledBlocks,
        },
        {
          outFilePath,
          weekStart: plan.meta.weekStart,
          weekEnd: plan.meta.weekEnd,
          schoolName: plan.meta.schoolName,
          simuladoTitle: plan.meta.projectName,
        },
      )
      done++
      if (done % 5 === 0) console.log(`[pdf]   ${done}/${plan.alunos.length} renderizados`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[pdf] ERRO matricula=${aluno.matricula}: ${msg}`)
    }
  }
  console.log(`[pdf] render concluído: ${done} sucesso, ${failed} falhas`)

  if (done === 0) {
    throw new Error('nenhum PDF renderizado — abortando antes de zipar')
  }

  console.log(`[pdf] criando zip ${outZip}`)
  execFileSync('zip', ['-r', '-q', outZip, '.'], {
    cwd: alunoOutDir,
    stdio: 'inherit',
  })
  console.log(`\n  ✅ ZIP gerado: ${outZip}`)
  console.log(`     - ${done} PDFs (cronograma por aluno, nomeados pelo nome)`)
}

// ----- Mode: test-all (Karpathy-style pipeline smoke across all schools) -----

interface TestRow {
  readonly school: SchoolInfo
  readonly project: ProjectInfo | null
  readonly status: 'PASS' | 'FAIL' | 'SKIP'
  readonly reason?: string
  readonly nAlunos?: number
  readonly nBlocos?: number
  readonly nValidados?: number
  readonly nSkipped?: number
  readonly nDropped?: number
  readonly avgBlocos?: number
  readonly violationsManhaDiaUtil?: number
}

function pickBestProject(projects: readonly ProjectInfo[]): ProjectInfo | null {
  // Mais recente com students cadastrados E pelo menos um dia processado
  const candidates = projects
    .filter((p) => p.studentsCount > 0 && (p.dia1 || p.dia2))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return candidates[0] ?? null
}

function runTestAll(): void {
  console.log(`\n[test-all] Karpathy-style smoke do pipeline em todas as schools`)
  console.log(`[test-all] read-only: NÃO persiste, NÃO escreve arquivos\n`)

  linkProject(SIMULADO_REF)
  const schools = listAllSchools()
  console.log(`[test-all] ${schools.length} schools no SIMULADO\n`)

  const results: TestRow[] = []
  const slots = buildSchedulableSlots()

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i]
    process.stderr.write(`  [${(i + 1).toString().padStart(2)}/${schools.length}] ${school.name.slice(0, 35).padEnd(35)} ... `)
    try {
      const projects = listProjectsForSchool(school.id)
      const best = pickBestProject(projects)
      if (!best) {
        results.push({ school, project: null, status: 'SKIP', reason: 'sem projeto processado com students' })
        process.stderr.write(`SKIP\n`)
        continue
      }
      const projeto = fetchProjetoData({ projectId: best.id, schoolId: school.id })
      const planos = projeto.students.map((s) => planForStudent(s, projeto.answerKey, slots))
      const nValidados = planos.length
      const nSkipped = projeto.students.length - nValidados // alunos que falharam parseProjetoStudent
      const nBlocos = planos.reduce((sum, a) => sum + a.scheduledBlocks.length, 0)
      const nDropped = planos.reduce((sum, a) => sum + a.droppedTopics.length, 0)
      // Invariant check (deve ser 0)
      const violations = planos.reduce(
        (sum, a) =>
          sum +
          a.scheduledBlocks.filter(
            (b) =>
              b.diaSemana !== 'sabado' &&
              b.diaSemana !== 'domingo' &&
              b.turno === 'manha',
          ).length,
        0,
      )
      results.push({
        school,
        project: best,
        status: 'PASS',
        nAlunos: best.studentsCount,
        nValidados,
        nSkipped,
        nBlocos,
        nDropped,
        avgBlocos: nValidados > 0 ? Math.round((nBlocos / nValidados) * 10) / 10 : 0,
        violationsManhaDiaUtil: violations,
      })
      process.stderr.write(`PASS (${nValidados} alunos, ${nBlocos} blocos)\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ school, project: null, status: 'FAIL', reason: msg.split('\n')[0] })
      process.stderr.write(`FAIL: ${msg.split('\n')[0].slice(0, 60)}\n`)
    }
  }

  printTestAllReport(results)
}

function printTestAllReport(results: readonly TestRow[]): void {
  const pass = results.filter((r) => r.status === 'PASS')
  const fail = results.filter((r) => r.status === 'FAIL')
  const skip = results.filter((r) => r.status === 'SKIP')

  console.log(`\n  =====================================================================`)
  console.log(`  RESUMO TEST-ALL`)
  console.log(`  =====================================================================`)
  console.log(`  Schools testadas:    ${results.length}`)
  console.log(`  PASS:                ${pass.length}`)
  console.log(`  FAIL:                ${fail.length}`)
  console.log(`  SKIP (sem projeto):  ${skip.length}`)

  const totalAlunos = pass.reduce((s, r) => s + (r.nValidados ?? 0), 0)
  const totalBlocos = pass.reduce((s, r) => s + (r.nBlocos ?? 0), 0)
  const totalViolations = pass.reduce((s, r) => s + (r.violationsManhaDiaUtil ?? 0), 0)
  const totalDropped = pass.reduce((s, r) => s + (r.nDropped ?? 0), 0)
  const totalParseSkipped = pass.reduce((s, r) => s + (r.nSkipped ?? 0), 0)

  console.log(``)
  console.log(`  Agregado (PASS):`)
  console.log(`    Alunos validados:           ${totalAlunos}`)
  console.log(`    Blocos planejados:          ${totalBlocos}`)
  console.log(`    Alunos parse-skipped:       ${totalParseSkipped}`)
  console.log(`    Tópicos dropados (capacidade): ${totalDropped}`)
  console.log(`    Violações manhã-dia-útil:   ${totalViolations}`)

  console.log(`\n  Detalhe por school (PASS):`)
  console.log(
    `    ${'school'.padEnd(34)} ${'alunos'.padStart(7)} ${'blocos'.padStart(7)} ${'avg/al'.padStart(7)} ${'dropped'.padStart(7)} ${'projeto (mais recente processado)'.padEnd(40)}`,
  )
  for (const r of pass.sort((a, b) => (b.nValidados ?? 0) - (a.nValidados ?? 0))) {
    const projDate = r.project?.createdAt.slice(0, 10) ?? '-'
    const projName = r.project ? `${projDate} ${r.project.name.slice(0, 30)}` : '-'
    console.log(
      `    ${r.school.name.slice(0, 32).padEnd(34)} ${String(r.nValidados).padStart(7)} ${String(r.nBlocos).padStart(7)} ${String(r.avgBlocos).padStart(7)} ${String(r.nDropped).padStart(7)} ${projName}`,
    )
  }

  if (fail.length > 0) {
    console.log(`\n  FAILS:`)
    for (const r of fail) {
      console.log(`    ${r.school.name}: ${r.reason}`)
    }
  }

  if (skip.length > 0) {
    console.log(`\n  SKIPS (sem projeto processado):`)
    for (const r of skip) {
      console.log(`    ${r.school.name}`)
    }
  }

  if (totalViolations > 0 || fail.length > 0) {
    process.exit(1)
  }
}

// ----- Mode: list-projects ---------------------------------------------------

function runListProjects(schoolId: string): void {
  linkProject(SIMULADO_REF)
  const school = fetchSchoolInfo(schoolId)
  const projects = listProjectsForSchool(schoolId)
  console.log(`\n  School: ${school.name} (${school.slug})`)
  console.log(`  Projetos disponíveis (${projects.length}):\n`)
  if (projects.length === 0) {
    console.log(`    (nenhum)`)
    return
  }
  console.log(`  ${'created'.padEnd(12)} ${'students'.padStart(8)} ${'d1'.padEnd(3)} ${'d2'.padEnd(3)} project_id                              nome`)
  for (const p of projects) {
    const date = p.createdAt.slice(0, 10)
    console.log(
      `  ${date.padEnd(12)} ${String(p.studentsCount).padStart(8)} ${p.dia1 ? 'ok ' : '-  '} ${p.dia2 ? 'ok ' : '-  '} ${p.id} ${p.name}`,
    )
  }
}

// ----- main ------------------------------------------------------------------

function parseArgs(args: string[]): {
  stage: string
  limit?: number
  schoolId?: string
  projectId?: string
  weekStart?: string
  listProjects: boolean
  testAll: boolean
} {
  const getFlag = (name: string): string | undefined => {
    const found = args.find((a) => a.startsWith(`--${name}=`))
    return found ? found.split('=').slice(1).join('=') : undefined
  }
  return {
    stage: getFlag('stage') ?? 'plan',
    limit: getFlag('limit') ? Number(getFlag('limit')) : undefined,
    schoolId: getFlag('school-id'),
    projectId: getFlag('project-id'),
    weekStart: getFlag('week-start'),
    listProjects: args.includes('--list-projects'),
    testAll: args.includes('--test-all'),
  }
}

function weekEndFromStart(weekStart: string): string {
  // weekStart is YYYY-MM-DD; add 6 days for Sunday
  const d = new Date(`${weekStart}T00:00:00Z`)
  if (isNaN(d.getTime())) {
    throw new Error(`--week-start inválido: ${weekStart} (esperado YYYY-MM-DD)`)
  }
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `--${name} é obrigatório. Use --help para detalhes.\nExemplo: --school-id=<uuid> --project-id=<uuid> --week-start=2026-05-25`,
    )
  }
  return value
}

function printUsage(): void {
  console.log(`
Uso:
  npx vite-node scripts/batch/generate-cronogramas.ts -- \\
    --school-id=<uuid> --project-id=<uuid> --week-start=YYYY-MM-DD \\
    --stage=plan|persist|pdf [--limit=N]

Descobrir projetos disponíveis numa school:
  npx vite-node scripts/batch/generate-cronogramas.ts -- \\
    --list-projects --school-id=<uuid>

Smoke do pipeline em TODAS as schools (Karpathy-style, read-only):
  npx vite-node scripts/batch/generate-cronogramas.ts -- --test-all

Stages:
  plan    (default) lê SIMULADO, computa plano, salva JSON local. SEM writes.
  persist INSERT cronograma + blocos em PRIMARY. Skip se já existir.
  pdf     renderiza PDFs (1 por aluno) e zipa.

Constraints aplicadas:
  - tópicos duplicados viram 1 bloco
  - dias úteis: apenas tarde + noite
  - fim de semana: livre (manhã + tarde + noite)
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    return
  }

  const parsed = parseArgs(args)
  mkdirSync(SCRIPT_DIR, { recursive: true })

  if (parsed.testAll) {
    runTestAll()
    return
  }

  if (parsed.listProjects) {
    const schoolId = requireArg(parsed.schoolId, 'school-id')
    runListProjects(schoolId)
    return
  }

  const schoolId = requireArg(parsed.schoolId, 'school-id')
  const projectId = requireArg(parsed.projectId, 'project-id')
  const weekStart = requireArg(parsed.weekStart, 'week-start')
  const cfg: RunConfig = {
    schoolId,
    projectId,
    weekStart,
    weekEnd: weekEndFromStart(weekStart),
  }

  switch (parsed.stage) {
    case 'plan':
      runPlanStage(cfg)
      break
    case 'persist':
      runPersistStage(cfg, parsed.limit)
      break
    case 'pdf':
      await runPdfStage(cfg)
      break
    default:
      throw new Error(`stage desconhecido: ${parsed.stage}. Use plan|persist|pdf`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
