/**
 * SchoolDetailModal — detalhes de atendimento de uma escola, aberto ao
 * clicar no card em "Saúde das Escolas" (Visão Executiva).
 *
 * Conteúdo: funil da escola (base → simulado → atendidos), PDFs entregues
 * por tipo, mentores com engajamento (view mentor_engagement) e a lista de
 * atendimentos (aluno, turma, último cronograma).
 */

import { useEffect, useState, type ReactElement } from 'react'

import { supabase } from '../../lib/supabase'
import { formatDateShortBR } from '../../lib/format-date'
import { saveBlobAsFile } from '../../lib/pdf-download'
import { PDF_TYPE_LABELS } from './pdf-types'
import {
  daysSinceLogin,
  engagementStatus,
  type MentorEngagementRow,
} from './mentor-engagement'
import {
  buildAtendimentos,
  buildMentorByStudent,
  type Atendimento,
  type MentorAttributionRow,
} from './school-detail'

export interface SchoolDetailModalProps {
  readonly school: {
    readonly school_id: string
    readonly primary_school_id?: string | null
    readonly name: string
    readonly alunos_base: number
    readonly alunos_com_simulado: number
    readonly alunos_atendidos: number
    readonly cronogramas_gerados: number
    readonly blocos_criados: number
  }
  readonly onClose: () => void
}

const MAX_ATENDIMENTOS_VISIVEIS = 60

type PdfHistoryMentorRow = {
  readonly tipo: string
  readonly aluno_id: string | null
  readonly matricula: string | null
  readonly created_by: string | null
  readonly created_at: string | null
}

type MentorPlanAttributionRow = {
  readonly student_key: string | null
  readonly mentor_user_id: string | null
  readonly created_at: string | null
  readonly updated_at: string | null
}

type AuditMentorRow = {
  readonly user_id: string | null
  readonly user_name: string | null
  readonly user_email: string | null
  readonly metadata: Record<string, unknown> | null
  readonly created_at: string | null
}

function safeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function auditMentorName(row: AuditMentorRow): string | null {
  const name = row.user_name?.trim()
  if (name) return name

  const email = row.user_email?.trim()
  if (!email) return null
  return email.split('@')[0] || email
}

export function SchoolDetailModal({ school, onClose }: SchoolDetailModalProps): ReactElement {
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportFeedback, setReportFeedback] = useState<string | null>(null)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [mentores, setMentores] = useState<MentorEngagementRow[]>([])
  const [pdfsPorTipo, setPdfsPorTipo] = useState<Record<string, number>>({})

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const primarySchoolId =
        school.primary_school_id === undefined ? school.school_id : school.primary_school_id

      if (!primarySchoolId) {
        if (!cancelled) {
          setAtendimentos([])
          setMentores([])
          setPdfsPorTipo({})
          setLoading(false)
        }
        return
      }

      const [studentsRes, mentoresRes, pdfsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, matricula, name, turma')
          .eq('school_id', primarySchoolId),
        supabase
          .from('mentor_engagement')
          .select('*')
          .eq('school_id', primarySchoolId)
          .order('last_login_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('pdf_history')
          .select('tipo, aluno_id, matricula, created_by, created_at')
          .eq('school_id', primarySchoolId),
      ])

      const students = (studentsRes.data ?? []) as Array<{
        id: string
        matricula: string
        name: string | null
        turma: string | null
      }>

      const alunoRefs = Array.from(
        new Set(students.flatMap((s) => [s.id, s.matricula]).filter(Boolean)),
      )
      const cronogramasRes = alunoRefs.length
        ? await supabase
            .from('cronogramas')
            .select('aluno_id, updated_at')
            .in('aluno_id', alunoRefs)
        : { data: [] }

      const mentorPlansRes = alunoRefs.length
        ? await supabase
            .from('mentor_plans')
            .select('student_key, mentor_user_id, created_at, updated_at')
            .eq('school_id', primarySchoolId)
            .in('student_key', alunoRefs)
        : { data: [] }
      const auditRes = await supabase
        .from('audit_log')
        .select('user_id, user_name, user_email, metadata, created_at')
        .eq('school_id', primarySchoolId)
        .eq('action', 'generate_pdf')

      const studentRefSet = new Set(alunoRefs)
      const studentKeysByName = new Map<string, string[]>()
      for (const student of students) {
        const nameKey = normalizeLookup(student.name ?? student.matricula)
        const keys = studentKeysByName.get(nameKey) ?? []
        studentKeysByName.set(nameKey, [...keys, student.id, student.matricula])
      }

      const mentorAttributions: MentorAttributionRow[] = []
      for (const row of (pdfsRes.data ?? []) as PdfHistoryMentorRow[]) {
        if (!row.created_by || !row.created_at) continue
        const keys = [row.aluno_id, row.matricula].filter(
          (key): key is string => Boolean(key && studentRefSet.has(key)),
        )
        for (const key of new Set(keys)) {
          mentorAttributions.push({
            studentKey: key,
            mentorUserId: row.created_by,
            createdAt: row.created_at,
          })
        }
      }
      for (const row of (mentorPlansRes.data ?? []) as MentorPlanAttributionRow[]) {
        if (!row.student_key || !row.mentor_user_id) continue
        mentorAttributions.push({
          studentKey: row.student_key,
          mentorUserId: row.mentor_user_id,
          createdAt: row.updated_at ?? row.created_at ?? '',
        })
      }
      for (const row of (auditRes.data ?? []) as AuditMentorRow[]) {
        const aluno = row.metadata?.aluno
        const mentorNome = auditMentorName(row)
        if (typeof aluno !== 'string' || !row.created_at || !mentorNome) continue

        const keys = studentKeysByName.get(normalizeLookup(aluno)) ?? []
        const uniqueKeys = Array.from(new Set(keys)).filter((key) => studentRefSet.has(key))
        if (uniqueKeys.length !== 2) continue

        for (const key of uniqueKeys) {
          mentorAttributions.push({
            studentKey: key,
            mentorUserId: row.user_id,
            mentorNome,
            createdAt: row.created_at,
          })
        }
      }

      const mentorUserIds = Array.from(
        new Set(
          mentorAttributions
            .map((row) => row.mentorUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      )
      const mentorUsersRes = mentorUserIds.length
        ? await supabase
            .from('project_users')
            .select('auth_uid, name, email')
            .in('auth_uid', mentorUserIds)
        : { data: [] }
      const mentorByStudent = buildMentorByStudent(
        mentorAttributions,
        (mentorUsersRes.data ?? []) as Array<{
          auth_uid: string | null
          name: string | null
          email: string | null
        }>,
      )

      if (cancelled) return

      setAtendimentos(
        buildAtendimentos(
          students,
          (cronogramasRes.data ?? []) as Array<{ aluno_id: string; updated_at: string }>,
          mentorByStudent,
        ),
      )
      setMentores((mentoresRes.data ?? []) as MentorEngagementRow[])

      const counts: Record<string, number> = {}
      for (const row of (pdfsRes.data ?? []) as Array<{ tipo: string }>) {
        counts[row.tipo] = (counts[row.tipo] ?? 0) + 1
      }
      setPdfsPorTipo(counts)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [school.primary_school_id, school.school_id])

  const coverage =
    school.alunos_base > 0
      ? Math.round((school.alunos_atendidos / school.alunos_base) * 100)
      : 0
  const visiveis = atendimentos.slice(0, MAX_ATENDIMENTOS_VISIVEIS)
  const ocultos = atendimentos.length - visiveis.length

  const handleDownloadReport = async () => {
    setGeneratingReport(true)
    setReportFeedback(null)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { SchoolReportPDF } = await import('./school-report-pdf')
      const generatedAt = new Date()
      const doc = createElement(SchoolReportPDF, {
        school,
        atendimentos,
        mentores,
        pdfsPorTipo,
        generatedAt,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generatedBlob = await pdf(doc as any).toBlob()
      const date = generatedAt.toISOString().slice(0, 10)
      const filename = `relatorio-escola-${safeFilename(school.name)}-${date}.pdf`
      saveBlobAsFile(generatedBlob, filename)
      setReportFeedback(`PDF gerado: ${filename}`)
    } catch (error) {
      console.error('[SchoolDetailModal] Falha ao gerar relatório da escola:', error)
      setReportFeedback(null)
      window.alert('Não consegui gerar o PDF agora. Tente novamente em instantes.')
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da escola ${school.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
              Detalhes da escola
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1d1d1f]">{school.name}</h2>
            {reportFeedback && (
              <p className="mt-1 text-xs font-medium text-[#15803d]">{reportFeedback}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReport}
              disabled={loading || generatingReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3 py-1.5 text-xs font-semibold text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-50"
              title="Gerar PDF do relatório da escola"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12 4-4m-4 4-4-4M4 20h16" />
              </svg>
              {generatingReport ? 'Gerando...' : 'PDF'}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#1d1d1f]"
              title="Fechar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Funil */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="text-lg font-semibold text-[#1d1d1f]">{school.alunos_base}</p>
              <p className="text-xs text-[#64748b]">alunos na base</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="text-lg font-semibold text-[#1d1d1f]">{school.alunos_com_simulado}</p>
              <p className="text-xs text-[#64748b]">fizeram simulado</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="text-lg font-semibold text-[#1d1d1f]">
                {school.alunos_atendidos}
                <span className="ml-1 text-xs font-normal text-[#94a3b8]">({coverage}%)</span>
              </p>
              <p className="text-xs text-[#64748b]">atendidos (cronograma)</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="text-lg font-semibold text-[#1d1d1f]">{school.cronogramas_gerados}</p>
              <p className="text-xs text-[#64748b]">cronogramas gerados</p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="text-lg font-semibold text-[#1d1d1f]">{school.blocos_criados}</p>
              <p className="text-xs text-[#64748b]">blocos criados</p>
            </div>
          </div>

          {/* PDFs entregues */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Documentos gerados
            </h3>
            {Object.keys(pdfsPorTipo).length === 0 ? (
              <p className="text-sm text-[#94a3b8]">{loading ? 'Carregando…' : 'Nenhum PDF gerado ainda.'}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(pdfsPorTipo).map(([tipo, total]) => (
                  <span
                    key={tipo}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1d4ed8]"
                  >
                    {PDF_TYPE_LABELS[tipo] ?? tipo}
                    <span className="font-bold">{total}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mentores */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Mentores da escola
            </h3>
            {mentores.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">{loading ? 'Carregando…' : 'Nenhum mentor vinculado.'}</p>
            ) : (
              <ul className="divide-y divide-[#f1f5f9] rounded-xl border border-[#e5e7eb]">
                {mentores.map((m) => {
                  const status = engagementStatus(m.last_login_at)
                  return (
                    <li key={m.email} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1d1d1f]">
                          {m.name || m.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          {m.pdfs_30d} PDFs · {m.alunos_30d} alunos · {m.planos_30d} planos (30d)
                        </p>
                      </div>
                      {status === 'ativo' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-medium text-[#15803d]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                          Ativo
                        </span>
                      ) : status === 'inativo' ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#92400e]">
                          {m.last_login_at ? `Inativo há ${daysSinceLogin(m.last_login_at)}d` : 'Inativo'}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-[#fef2f2] px-2 py-0.5 text-xs font-medium text-[#b91c1c]">
                          Nunca acessou
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Atendimentos */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Atendimentos ({atendimentos.length})
            </h3>
            {atendimentos.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">
                {loading ? 'Carregando…' : 'Nenhum aluno com cronograma ainda.'}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Aluno</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Turma</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">Último cronograma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((a) => (
                      <tr key={a.matricula} className="border-b border-[#f1f5f9]">
                        <td className="px-4 py-2">
                          <p className="text-sm text-[#1d1d1f]">{a.nome}</p>
                          <p className="text-xs font-mono text-[#94a3b8]">{a.matricula}</p>
                          <p className="mt-0.5 text-xs text-[#64748b]">
                            Mentor: {a.mentorNome ?? 'não registrado'}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-xs text-[#64748b]">{a.turma}</td>
                        <td className="px-4 py-2 text-right text-xs text-[#64748b]">
                          {formatDateShortBR(a.ultimoCronograma)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ocultos > 0 && (
                  <p className="bg-[#fafafa] px-4 py-2 text-center text-xs text-[#94a3b8]">
                    + {ocultos} atendimentos mais antigos
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
