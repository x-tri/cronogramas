import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { isSupabaseConfigured } from '../../config/repository-config'
import { ALL_STUDENTS } from '../../data/mock-data/students'

type AuditRecord = {
  alunoId: string
  nome: string
  matricula: string
  turma: string
  email: string | null
  escola: string
  schoolId: string | null
  lastCronogramaDate: Date
  totalCronogramas: number
}

function exportToCSV(records: AuditRecord[]) {
  const BOM = '\uFEFF'
  const headers = ['Nome', 'Turma', 'Matrícula', 'Email', 'Escola', 'Último Cronograma', 'Total Cronogramas']
  const rows = records.map(r => [
    r.nome,
    r.turma,
    r.matricula,
    r.email || '',
    r.escola,
    r.lastCronogramaDate.toLocaleDateString('pt-BR'),
    r.totalCronogramas.toString(),
  ])

  const csv = BOM + [headers, ...rows].map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria-cronogramas-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  const loadAuditData = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase não configurado')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Query cronogramas with student data
      // Join cronogramas → alunos_xtris (via aluno_id)
      const { data: cronogramas, error: cronError } = await supabase
        .from('cronogramas')
        .select('aluno_id, created_at')
        .order('created_at', { ascending: false })

      if (cronError) throw new Error(cronError.message)
      if (!cronogramas?.length) {
        setRecords([])
        setIsLoading(false)
        return
      }

      // Group by aluno_id: latest date + count
      const alunoMap = new Map<string, { lastDate: string; count: number }>()
      for (const c of cronogramas) {
        const existing = alunoMap.get(c.aluno_id)
        if (!existing) {
          alunoMap.set(c.aluno_id, { lastDate: c.created_at, count: 1 })
        } else {
          existing.count++
        }
      }

      // Fetch student details from multiple sources
      const alunoIds = Array.from(alunoMap.keys())

      // Build mock student lookup (matricula → student data, all are Marista)
      const mockLookup = new Map<string, { nome: string; turma: string }>()
      for (const s of ALL_STUDENTS) {
        mockLookup.set(s.matricula, { nome: s.nome, turma: s.turma })
      }

      // Separate UUIDs from non-UUIDs (matriculas used as aluno_id by mock students)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const uuidIds = alunoIds.filter(id => uuidRegex.test(id))
      const nonUuidIds = alunoIds.filter(id => !uuidRegex.test(id))

      // Source 1: students table by UUID id
      type StudentRow = {
        id: string; name: string; matricula: string; turma: string; school_id: string
        school: { id: string; name: string } | { id: string; name: string }[] | null
      }
      let mainStudents: StudentRow[] | null = null
      if (uuidIds.length > 0) {
        const { data, error: studErr } = await supabase
          .from('students')
          .select('id, name, matricula, turma, school_id')
          .in('id', uuidIds)
        if (studErr) console.warn('[Audit] students by id error:', studErr.message)
        mainStudents = (data || []).map(s => ({ ...s, school: null })) as StudentRow[]
      }

      // Source 2: alunos_xtris table (XTRI-specific, may not exist)
      let xtriStudents: Array<{ id: string; nome: string; matricula: string; turma: string; email: string | null; escola_nome: string | null; school_id: string | null }> | null = null
      if (uuidIds.length > 0) {
        const { data } = await supabase
          .from('alunos_xtris')
          .select('id, nome, matricula, turma, email, escola_nome, school_id')
          .in('id', uuidIds)
        xtriStudents = data  // null if table doesn't exist
      }

      // Source 3: Try matching by matricula for students not found by UUID
      const unresolvedIds = [
        ...nonUuidIds.filter(id => !mockLookup.has(id)), // skip mock students
        ...uuidIds.filter(id => !mainStudents?.some(s => s.id === id) && !xtriStudents?.some(s => s.id === id)),
      ]

      let matriculaStudents: StudentRow[] | null = null
      if (unresolvedIds.length > 0) {
        const { data } = await supabase
          .from('students')
          .select('id, name, matricula, turma, school_id')
          .in('matricula', unresolvedIds)
        matriculaStudents = (data || []).map(s => ({ ...s, school: null })) as StudentRow[]
      }

      // Resolve school names from school_ids
      const allSchoolIds = new Set<string>()
      for (const s of (mainStudents || [])) { if (s.school_id) allSchoolIds.add(s.school_id) }
      for (const s of (matriculaStudents || [])) { if (s.school_id) allSchoolIds.add(s.school_id) }

      // Known school_id → name mapping (fallback when RLS blocks schools table)
      const KNOWN_SCHOOLS: Record<string, string> = {
        '50c6894c-f97d-482f-b208-c8c35d3adea3': 'Colégio Marista de Natal',
      }

      const schoolNameMap = new Map<string, string>()

      if (allSchoolIds.size > 0) {
        // Try RPC function first (SECURITY DEFINER, bypasses RLS)
        const { data: rpcSchools, error: rpcErr } = await supabase
          .rpc('get_school_names', { school_ids: Array.from(allSchoolIds) })

        if (!rpcErr && rpcSchools) {
          for (const s of rpcSchools as Array<{ id: string; name: string }>) {
            schoolNameMap.set(s.id, s.name)
          }
        } else {
          console.warn('[Audit] RPC get_school_names not available, using known schools:', rpcErr?.message)
        }

        // Fill any unresolved with known schools
        for (const sid of allSchoolIds) {
          if (!schoolNameMap.has(sid) && KNOWN_SCHOOLS[sid]) {
            schoolNameMap.set(sid, KNOWN_SCHOOLS[sid])
          }
        }
      }

      const auditRecords: AuditRecord[] = []
      const resolved = new Set<string>()

      // Helper: get school name for a student row
      const getSchoolName = (s: StudentRow): string => {
        if (s.school_id && schoolNameMap.has(s.school_id)) return schoolNameMap.get(s.school_id)!
        if (s.school) {
          const school = Array.isArray(s.school) ? s.school[0] : s.school
          if (school?.name) return school.name
        }
        if (s.school_id) return `Escola (${s.school_id.slice(0, 8)})`
        return 'Sem escola'
      }

      // Helper: normalize turma — single letters A-E → 3A-3E (3ª série Marista)
      const normalizeTurma = (turma: string): string => {
        if (/^[A-E]$/i.test(turma)) return `3${turma.toUpperCase()}`
        return turma
      }

      // Pass 0: mock students (ALL_STUDENTS — all Marista, ID = matricula)
      for (const alunoId of nonUuidIds) {
        const mock = mockLookup.get(alunoId)
        if (!mock) continue
        const info = alunoMap.get(alunoId)
        if (!info) continue
        resolved.add(alunoId)
        auditRecords.push({
          alunoId,
          nome: mock.nome,
          matricula: alunoId,
          turma: normalizeTurma(mock.turma),
          email: null,
          escola: 'Colégio Marista de Natal',
          schoolId: null,
          lastCronogramaDate: new Date(info.lastDate),
          totalCronogramas: info.count,
        })
      }

      // Pass 1: students table matched by UUID id
      if (mainStudents) {
        for (const s of mainStudents) {
          const info = alunoMap.get(s.id)
          if (!info) continue
          resolved.add(s.id)
          auditRecords.push({
            alunoId: s.id,
            nome: s.name || 'Sem nome',
            matricula: s.matricula || s.id,
            turma: normalizeTurma(s.turma || '-'),
            email: null,
            escola: getSchoolName(s),
            schoolId: s.school_id || null,
            lastCronogramaDate: new Date(info.lastDate),
            totalCronogramas: info.count,
          })
        }
      }

      // Pass 2: students matched by matricula
      if (matriculaStudents) {
        for (const s of matriculaStudents) {
          const info = alunoMap.get(s.matricula)
          if (!info || resolved.has(s.matricula)) continue
          resolved.add(s.matricula)
          auditRecords.push({
            alunoId: s.matricula,
            nome: s.name || 'Sem nome',
            matricula: s.matricula,
            turma: normalizeTurma(s.turma || '-'),
            email: null,
            escola: getSchoolName(s),
            schoolId: s.school_id || null,
            lastCronogramaDate: new Date(info.lastDate),
            totalCronogramas: info.count,
          })
        }
      }

      // Pass 3: alunos_xtris (for any not found in students)
      if (xtriStudents) {
        for (const s of xtriStudents) {
          if (resolved.has(s.id)) continue
          const info = alunoMap.get(s.id)
          if (!info) continue
          resolved.add(s.id)
          auditRecords.push({
            alunoId: s.id,
            nome: s.nome || 'Sem nome',
            matricula: s.matricula || s.id,
            turma: s.turma || '-',
            email: s.email || null,
            escola: s.escola_nome || 'XTRI',
            schoolId: s.school_id || null,
            lastCronogramaDate: new Date(info.lastDate),
            totalCronogramas: info.count,
          })
        }
      }

      // Pass 4: any remaining (not found in any table)
      for (const [alunoId, info] of alunoMap) {
        if (resolved.has(alunoId)) continue
        auditRecords.push({
          alunoId,
          nome: `Aluno ${alunoId.slice(0, 8)}`,
          matricula: alunoId,
          turma: '-',
          email: null,
          escola: 'Desconhecido',
          schoolId: null,
          lastCronogramaDate: new Date(info.lastDate),
          totalCronogramas: info.count,
        })
      }

      // Deduplicate by matricula — merge cronograma counts and keep most recent date
      const deduped = new Map<string, AuditRecord>()
      for (const r of auditRecords) {
        const key = r.matricula
        const existing = deduped.get(key)
        if (!existing) {
          deduped.set(key, r)
        } else {
          existing.totalCronogramas += r.totalCronogramas
          if (r.lastCronogramaDate > existing.lastCronogramaDate) {
            existing.lastCronogramaDate = r.lastCronogramaDate
          }
          // Keep the version with more info
          if (existing.nome.startsWith('Aluno ') && !r.nome.startsWith('Aluno ')) {
            existing.nome = r.nome
            existing.turma = r.turma
            existing.email = r.email || existing.email
            existing.escola = r.escola
            existing.schoolId = r.schoolId
          }
        }
      }

      const finalRecords = Array.from(deduped.values())
      finalRecords.sort((a, b) => b.lastCronogramaDate.getTime() - a.lastCronogramaDate.getTime())
      setRecords(finalRecords)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && records.length === 0) {
      loadAuditData()
    }
  }, [isOpen])

  // Group by school
  const grouped = useMemo(() => {
    const q = searchFilter.toLowerCase()
    const filtered = q
      ? records.filter(r =>
          r.nome.toLowerCase().includes(q) ||
          r.matricula.toLowerCase().includes(q) ||
          r.turma.toLowerCase().includes(q) ||
          r.escola.toLowerCase().includes(q)
        )
      : records

    const map = new Map<string, AuditRecord[]>()
    for (const r of filtered) {
      const key = r.escola || 'Sem escola'
      const arr = map.get(key) || []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [records, searchFilter])

  const totalStudents = records.length

  return (
    <>
      {/* Trigger button in header */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-1 text-xs font-medium text-[#64748b] hover:text-[#1d1d1f] hover:bg-[#f1f1ef] rounded-md transition-colors"
        title="Auditoria de cronogramas"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 px-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-apple-scale-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#e5e7eb] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#1d1d1f]">Auditoria de Cronogramas</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {totalStudents} aluno{totalStudents !== 1 ? 's' : ''} com cronogramas criados
                </p>
              </div>
              <div className="flex items-center gap-2">
                {records.length > 0 && (
                  <button
                    onClick={() => exportToCSV(records)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar Excel
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#f1f1ef] text-[#94a3b8] hover:text-[#1d1d1f] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-[#f1f5f9] flex-shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Filtrar por nome, matrícula, turma ou escola..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/20"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
                  <span className="ml-3 text-sm text-[#94a3b8]">Carregando dados...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-sm text-red-600">{error}</p>
                  <button onClick={loadAuditData} className="mt-2 text-xs text-[#2563eb] hover:underline">
                    Tentar novamente
                  </button>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-[#94a3b8]">
                  <svg className="w-10 h-10 mx-auto mb-2 text-[#d4d4d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">Nenhum cronograma criado ainda</p>
                </div>
              ) : (
                Array.from(grouped.entries()).map(([schoolName, students]) => (
                  <div key={schoolName} className="mb-5">
                    {/* School header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-sm bg-[#2563eb]" />
                      <h3 className="text-sm font-bold text-[#1d1d1f]">{schoolName}</h3>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] rounded-full">
                        {students.length}
                      </span>
                    </div>

                    {/* Table */}
                    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f8fafc] border-b border-[#e5e7eb]">
                            <th className="text-left px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Nome</th>
                            <th className="text-left px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Turma</th>
                            <th className="text-left px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Matrícula</th>
                            <th className="text-left px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Email</th>
                            <th className="text-left px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Último Cronograma</th>
                            <th className="text-center px-3 py-2 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((r, i) => (
                            <tr
                              key={r.alunoId}
                              className={`border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafafa] transition-colors ${i % 2 === 0 ? '' : 'bg-[#fafbfc]'}`}
                            >
                              <td className="px-3 py-2 font-medium text-[#1d1d1f]">{r.nome}</td>
                              <td className="px-3 py-2 text-[#64748b]">{r.turma}</td>
                              <td className="px-3 py-2 text-[#64748b] font-mono text-xs">{r.matricula}</td>
                              <td className="px-3 py-2 text-[#94a3b8] text-xs truncate max-w-[180px]">{r.email || '—'}</td>
                              <td className="px-3 py-2 text-[#64748b] text-xs tabular-nums">
                                {r.lastCronogramaDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-1.5 py-0.5 bg-[#e0f2fe] text-[#2563eb] text-[10px] font-bold rounded-full">
                                  {r.totalCronogramas}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
