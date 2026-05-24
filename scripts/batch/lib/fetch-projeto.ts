/**
 * Fetch dados do projeto + students do SIMULADO via supabase CLI.
 *
 * Por que CLI e não supabase-js?
 *   - CLI tem auth via keyring local (já funciona) sem precisar service_role
 *   - Script roda local, não em browser, então não tem ambiente Vite
 *   - 1 query para ~44 students é barato
 *
 * Pre-req: `npx supabase link --project-ref axtmozyrnsrhqrnktshz` rodado antes.
 */

import { execFileSync } from 'node:child_process'

import { parseProjetoStudent } from '../../../src/lib/contracts/gabarito-scanner'
import type { ProjetoStudent } from '../../../src/lib/contracts/gabarito-scanner'

export interface ProjetoData {
  readonly projectId: string
  readonly projectName: string
  readonly answerKey: readonly string[]
  readonly students: readonly ProjetoStudent[]
}

export interface FetchOptions {
  readonly projectId: string
  /** Filtra alunos por school_id (opcional). */
  readonly schoolId?: string
}

function runSql(sql: string): unknown {
  const out = execFileSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--agent', 'yes', '--output', 'json', sql],
    { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 },
  )
  return JSON.parse(out)
}

/**
 * Carrega projeto inteiro (answer_key + students JSONB) e retorna students
 * já validados via Zod (parseProjetoStudent). Alunos que falharem a validação
 * são pulados com warning no stderr.
 */
export function fetchProjetoData(opts: FetchOptions): ProjetoData {
  const sql = `SELECT id::text AS project_id, nome AS project_name, answer_key, students::text AS students_json FROM projetos WHERE id='${opts.projectId}'`

  const result = runSql(sql) as { rows: Array<{ project_id: string; project_name: string; answer_key: string[]; students_json: string }> }
  if (!result.rows || result.rows.length === 0) {
    throw new Error(`projeto não encontrado: ${opts.projectId}`)
  }

  const row = result.rows[0]
  const rawStudents = JSON.parse(row.students_json) as unknown[]

  const validated: ProjetoStudent[] = []
  let skipped = 0
  for (const raw of rawStudents) {
    try {
      const student = parseProjetoStudent(raw)
      validated.push(student)
    } catch (err) {
      skipped += 1
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`  [warn] skipped student (validation): ${msg.split('\n')[0]}\n`)
    }
  }

  if (skipped > 0) {
    process.stderr.write(`  [warn] ${skipped} students skipped during validation\n`)
  }

  return {
    projectId: row.project_id,
    projectName: row.project_name,
    answerKey: row.answer_key,
    students: validated,
  }
}

/**
 * Resolve school_id + matricula → student.id no PRIMARY (necessario para
 * criar cronograma + blocos com FK valido).
 *
 * Lê do PRIMARY, então o caller precisa relinkar antes:
 *   npx supabase link --project-ref comwcnmvnuzqqbypjtqn
 */
export function fetchPrimaryStudentIds(schoolId: string): Map<string, string> {
  const sql = `SELECT id::text, matricula FROM students WHERE school_id='${schoolId}'`
  const result = runSql(sql) as { rows: Array<{ id: string; matricula: string }> }
  const byMatricula = new Map<string, string>()
  for (const r of result.rows) {
    byMatricula.set(r.matricula, r.id)
  }
  return byMatricula
}

/**
 * Helper para trocar de projeto Supabase via CLI.
 */
export function linkProject(projectRef: string): void {
  execFileSync('npx', ['supabase', 'link', '--project-ref', projectRef], {
    encoding: 'utf-8',
    stdio: ['inherit', 'ignore', 'inherit'],
  })
}

export interface SchoolInfo {
  readonly id: string
  readonly name: string
  readonly slug: string
}

/**
 * Busca metadata básica da school (id, name, slug) no SIMULADO.
 * Caller precisa estar linkado em SIMULADO antes.
 */
export function fetchSchoolInfo(schoolId: string): SchoolInfo {
  const sql = `SELECT id::text, name, slug FROM schools WHERE id='${schoolId}'`
  const result = runSql(sql) as { rows: Array<{ id: string; name: string; slug: string }> }
  if (!result.rows || result.rows.length === 0) {
    throw new Error(`school não encontrada no SIMULADO: ${schoolId}`)
  }
  return result.rows[0]
}

export interface ProjectInfo {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly studentsCount: number
  readonly dia1: boolean
  readonly dia2: boolean
}

/**
 * Lista projetos de uma school no SIMULADO, ordenados por data desc.
 * Útil para o user descobrir o project_id correto pra rodar o batch.
 */
/**
 * Lista todas as schools do SIMULADO. Caller precisa estar linkado em SIMULADO.
 */
export function listAllSchools(): SchoolInfo[] {
  const sql = `SELECT id::text, name, slug FROM schools ORDER BY name`
  const result = runSql(sql) as { rows: Array<{ id: string; name: string; slug: string }> }
  return result.rows
}

export function listProjectsForSchool(schoolId: string): ProjectInfo[] {
  const sql = `SELECT id::text, nome AS name, created_at::text AS created_at, jsonb_array_length(students) AS students_count, dia1_processado AS dia1, dia2_processado AS dia2 FROM projetos WHERE school_id='${schoolId}' ORDER BY created_at DESC`
  const result = runSql(sql) as {
    rows: Array<{
      id: string
      name: string
      created_at: string
      students_count: number
      dia1: boolean
      dia2: boolean
    }>
  }
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    studentsCount: r.students_count,
    dia1: r.dia1,
    dia2: r.dia2,
  }))
}
