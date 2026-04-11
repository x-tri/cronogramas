import { supabase } from '../lib/supabase'
import { getCurrentProjectUser } from '../lib/project-user'
import { logAudit } from './audit'
import type { ReportData, CursoEscolhido } from '../types/report'

// ============ TYPES ============

export interface SaveReportParams {
  readonly studentKey: string
  readonly studentName: string
  readonly turma?: string
  readonly examId: string
  readonly examTitle?: string
  readonly curso: CursoEscolhido
  readonly reportData: ReportData
  readonly pdfHistoryId?: string
}

export interface StudentReport {
  readonly id: string
  readonly schoolId: string | null
  readonly studentKey: string
  readonly studentName: string
  readonly turma: string | null
  readonly examId: string
  readonly examTitle: string | null
  readonly cursoNome: string | null
  readonly cursoUniversidade: string | null
  readonly reportData: ReportData
  readonly reportType: string
  readonly pdfHistoryId: string | null
  readonly createdBy: string | null
  readonly createdAt: string
}

interface StudentReportRow {
  readonly id: string
  readonly school_id: string | null
  readonly student_key: string
  readonly student_name: string
  readonly turma: string | null
  readonly exam_id: string
  readonly exam_title: string | null
  readonly curso_nome: string | null
  readonly curso_universidade: string | null
  readonly report_data: ReportData
  readonly report_type: string
  readonly pdf_history_id: string | null
  readonly created_by: string | null
  readonly created_at: string
}

// ============ CONVERTERS ============

function reportFromRow(row: StudentReportRow): StudentReport {
  return {
    id: row.id,
    schoolId: row.school_id,
    studentKey: row.student_key,
    studentName: row.student_name,
    turma: row.turma,
    examId: row.exam_id,
    examTitle: row.exam_title,
    cursoNome: row.curso_nome,
    cursoUniversidade: row.curso_universidade,
    reportData: row.report_data,
    reportType: row.report_type,
    pdfHistoryId: row.pdf_history_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

// ============ SAVE ============

/**
 * Salva o ReportData do Relatório Cirúrgico no Supabase.
 * Fire-and-forget friendly — retorna o ID do registro ou null em caso de erro.
 */
export async function saveStudentReport(
  params: SaveReportParams,
): Promise<string | null> {
  try {
    const projectUser = await getCurrentProjectUser()
    const schoolId = projectUser?.schoolId ?? null

    const { data, error } = await supabase
      .from('student_reports')
      .insert({
        school_id: schoolId,
        student_key: params.studentKey,
        student_name: params.studentName,
        turma: params.turma ?? null,
        exam_id: params.examId,
        exam_title: params.examTitle ?? null,
        curso_nome: params.curso.nome,
        curso_universidade: params.curso.universidade,
        report_data: params.reportData,
        report_type: 'cirurgico',
        pdf_history_id: params.pdfHistoryId ?? null,
        created_by: projectUser?.userId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[student-report-storage] Falha ao salvar relatório:', error.message)
      return null
    }

    logAudit('generate_pdf', 'student_report', data.id, {
      studentKey: params.studentKey,
      studentName: params.studentName,
      examId: params.examId,
      curso: params.curso.nome,
    })

    return data.id
  } catch (err) {
    console.warn('[student-report-storage] Erro inesperado ao salvar:', err)
    return null
  }
}

// ============ QUERY ============

/**
 * Lista relatórios salvos de um aluno, mais recentes primeiro.
 */
export async function getStudentReports(
  studentKey: string,
  limit = 20,
): Promise<ReadonlyArray<StudentReport>> {
  const { data, error } = await supabase
    .from('student_reports')
    .select('*')
    .eq('student_key', studentKey)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[student-report-storage] Falha ao buscar relatórios:', error.message)
    return []
  }

  return (data as ReadonlyArray<StudentReportRow>).map(reportFromRow)
}

/**
 * Busca um relatório específico pelo ID.
 */
export async function getStudentReportById(
  reportId: string,
): Promise<StudentReport | null> {
  const { data, error } = await supabase
    .from('student_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (error) {
    console.warn('[student-report-storage] Relatório não encontrado:', error.message)
    return null
  }

  return reportFromRow(data as StudentReportRow)
}

/**
 * Verifica se já existe um relatório para este aluno + simulado + curso.
 * Evita duplicatas quando o usuário gera o mesmo relatório múltiplas vezes.
 */
export async function findExistingReport(
  studentKey: string,
  examId: string,
  cursoNome: string,
): Promise<StudentReport | null> {
  const { data, error } = await supabase
    .from('student_reports')
    .select('*')
    .eq('student_key', studentKey)
    .eq('exam_id', examId)
    .eq('curso_nome', cursoNome)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return reportFromRow(data as StudentReportRow)
}
