/**
 * Runner de I/O do importador gabaritos → portal.
 *
 * Lê o exame + student_answers do projeto Supabase do gabaritos e escreve
 * simulado/itens/respostas no projeto Supabase do portal (via service-role),
 * reaproveitando as funções puras de `import-from-gabaritos.ts`.
 *
 * Uso:
 *   npx tsx scripts/import-exam-to-portal.ts \
 *     --gabaritos-exam <exam_id> --portal-school <school_id> \
 *     [--title "Prova 1 (Simulado 1)"] [--dry-run] [--only-matricula 214140291]
 *
 * Parâmetros:
 *   --gabaritos-exam <id>   (obrigatório) id do exame no projeto gabaritos.
 *   --portal-school <id>    (obrigatório) school_id no projeto portal.
 *   --title "..."           (opcional)    título do simulado; default = exam.title.
 *   --dry-run               (opcional)    apenas reporta o plano, não escreve nada.
 *   --only-matricula <m>    (opcional)    importa só a matrícula informada.
 *
 * Env vars:
 *   PORTAL_SUPABASE_URL, PORTAL_SERVICE_ROLE_KEY,
 *   GABARITOS_SUPABASE_URL, GABARITOS_SERVICE_ROLE_KEY.
 *
 * Nota: requer um runner de TypeScript (ex.: `tsx` ou `vite-node`) — ainda não
 * está nas devDeps do projeto. Instale antes de rodar: `npm i -D tsx`.
 */
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
