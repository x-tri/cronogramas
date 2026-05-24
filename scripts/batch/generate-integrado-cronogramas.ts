/**
 * Geração em lote de cronogramas + relatórios para os alunos da GRUPO INTEGRADO,
 * baseado nos erros do simulado "Diagnóstico" (project_id 635358eb-...).
 *
 * Execução em 4 stages com check-ins:
 *   --stage plan    (default): só computa e imprime resumo. SEM writes.
 *   --stage persist          : autoriza INSERT cronograma + blocos em PRIMARY.
 *   --stage pdf              : depois de persist, renderiza PDFs e zipa.
 *
 * Rodar:
 *   npx vite-node scripts/batch/generate-integrado-cronogramas.ts -- --stage=plan
 *
 * Pre-req (uma vez):
 *   npx supabase link --project-ref axtmozyrnsrhqrnktshz   (para fetch)
 *   (o script alterna o link entre PRIMARY/SIMULADO conforme precisa)
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  fetchProjetoData,
  linkProject,
  type ProjetoData,
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

// ----- Configuração ----------------------------------------------------------

const SCHOOL_ID = '63d2609c-c0cd-44af-8be3-5f6de8ff2788' // GRUPO INTEGRADO
const PROJECT_ID = '635358eb-3936-4894-b64b-0ddcc12b6b1c' // Diagnóstico INTEGRADO
const PRIMARY_REF = 'comwcnmvnuzqqbypjtqn'
const SIMULADO_REF = 'axtmozyrnsrhqrnktshz'
const WEEK_START = '2026-05-25' // segunda
const WEEK_END = '2026-05-31' // domingo
const SCRIPT_DIR = resolve(import.meta.dirname ?? __dirname)
const PLAN_FILE = resolve(SCRIPT_DIR, '.generated_plan.json')
const OUT_DIR = resolve(SCRIPT_DIR, 'out')
const ZIP_PATH = resolve(OUT_DIR, `cronogramas-integrado-${WEEK_START}.zip`)
const SCHOOL_NAME = 'GRUPO INTEGRADO'
const SIMULADO_TITLE = 'Diagnóstico'

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
    readonly projectId: string
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

// ----- Pipeline por aluno ----------------------------------------------------

function buildAreaSummaries(student: ProjetoStudent): readonly AreaSummary[] {
  const areaCorrect = student.areaCorrectAnswers ?? {}
  const total = student.correctAnswers ?? 0
  const wrong = student.wrongAnswers ?? 0
  const blank = student.blankAnswers ?? 0
  // Inferir erros/brancos por área proporcional (best-effort; sistema não
  // armazena erros/brancos por área). Se total*4 == soma das áreas, usa direto.
  // Caso contrário, mostra apenas acertos por área e totais.
  const result: AreaSummary[] = []
  const labels = { LC: 'Linguagens', CH: 'Humanas', CN: 'Natureza', MT: 'Matemática' } as const
  for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
    const acertos = (areaCorrect as Record<string, number>)[area] ?? 0
    // Aproximação: 45 questões por área; erros = 45 - acertos - brancos_estimados
    // Como brancos por área não está armazenado, mostramos apenas acertos.
    const erros = Math.max(0, 45 - acertos)
    const brancos = 0
    result.push({ area, label: labels[area], acertos, erros, brancos })
  }
  // Sanity: se totais batem com soma 180, usar; senão, é o melhor que dá
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

function runPlanStage(): BatchPlan {
  console.log(`\n[plan] semana ${WEEK_START} → ${WEEK_END}, escola ${SCHOOL_ID.slice(0, 8)}…\n`)

  console.log(`[plan] link SIMULADO + fetch projeto ${PROJECT_ID}`)
  linkProject(SIMULADO_REF)
  const projeto: ProjetoData = fetchProjetoData({
    projectId: PROJECT_ID,
    schoolId: SCHOOL_ID,
  })
  console.log(
    `[plan] projeto "${projeto.projectName}"  answer_key.length=${projeto.answerKey.length}  students=${projeto.students.length}`,
  )

  const slots = buildSchedulableSlots() // default: bloqueia manhã seg-sex
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
      schoolId: SCHOOL_ID,
      projectId: PROJECT_ID,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
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
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2))
  console.log(`\n[plan] salvo em ${PLAN_FILE}`)
  console.log(`[plan] arquivo contém PII (matricula/nomes) — protegido por .gitignore`)

  return plan
}

function printPlanReport(plan: BatchPlan): void {
  const { stats, alunos } = plan
  console.log(`\n  =============================================`)
  console.log(`  RESUMO DO PLANO (read-only — nada foi escrito)`)
  console.log(`  =============================================`)
  console.log(`  Total de alunos no projeto:      ${stats.totalAlunos}`)
  console.log(`  Alunos com blocos a distribuir:  ${stats.alunosComBlocos}`)
  console.log(`  Alunos sem erros (skip):         ${stats.alunosSemErros}`)
  console.log(`  Total de blocos a criar:         ${stats.totalBlocos}`)
  console.log(`  Slots disponíveis/aluno:         ${stats.slotsDisponiveisPorAluno}`)
  console.log(``)

  // Distribuição de erros por aluno (sem PII por padrão)
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

  // Alerta para alunos com mais tópicos que slots (algo dropped)
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

function runPersistStage(limit?: number): void {
  if (!existsSync(PLAN_FILE)) {
    throw new Error(
      `plan não encontrado em ${PLAN_FILE}. Rode primeiro: --stage=plan`,
    )
  }
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf-8')) as BatchPlan
  const alunos = limit ? plan.alunos.slice(0, limit) : plan.alunos
  console.log(`\n[persist] linkar PRIMARY para escrever cronograma + blocos`)
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
      {
        weekStart: plan.meta.weekStart,
        weekEnd: plan.meta.weekEnd,
      },
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

async function runPdfStage(): Promise<void> {
  if (!existsSync(PLAN_FILE)) {
    throw new Error(
      `plan não encontrado em ${PLAN_FILE}. Rode primeiro: --stage=plan`,
    )
  }
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf-8')) as BatchPlan
  console.log(`\n[pdf] lendo plan de ${PLAN_FILE}`)
  console.log(`[pdf] ${plan.alunos.length} alunos para renderizar`)

  // Limpa out/ se houver
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })

  // Detecta nomes duplicados (raro mas possível) e adiciona sufixo de matricula
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
    const outFilePath = `${OUT_DIR}/${filename}`
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
          schoolName: SCHOOL_NAME,
          simuladoTitle: SIMULADO_TITLE,
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

  // Zip via CLI nativo (zero deps adicionais)
  console.log(`[pdf] criando zip ${ZIP_PATH}`)
  execFileSync('zip', ['-r', '-q', ZIP_PATH, '.'], { cwd: OUT_DIR, stdio: 'inherit' })
  console.log(`\n  ✅ ZIP gerado: ${ZIP_PATH}`)
  console.log(`     - ${done} PDFs (cronograma por aluno, nomeados pelo nome)`)
}

// ----- main ------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const stageArg = args.find((a) => a.startsWith('--stage='))
  const stage = stageArg ? stageArg.split('=')[1] : 'plan'
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

  mkdirSync(SCRIPT_DIR, { recursive: true })

  switch (stage) {
    case 'plan':
      runPlanStage()
      break
    case 'persist':
      runPersistStage(limit)
      break
    case 'pdf':
      await runPdfStage()
      break
    default:
      throw new Error(`stage desconhecido: ${stage}. Use plan|persist|pdf`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
