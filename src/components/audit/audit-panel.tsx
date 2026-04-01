import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { isSupabaseConfigured } from '../../config/repository-config'

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

export function AuditPanel({ variant = 'default', coordinatorSchoolId }: { variant?: 'default' | 'icon'; coordinatorSchoolId?: string | null } = {}) {
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
      // 0. Se coordenador tem escola, buscar alunos da escola para filtrar
      let schoolStudentIds: Set<string> | null = null
      if (coordinatorSchoolId) {
        const { data: schoolStudents } = await supabase
          .from('students')
          .select('id, matricula')
          .eq('school_id', coordinatorSchoolId)
        if (schoolStudents && schoolStudents.length > 0) {
          schoolStudentIds = new Set<string>()
          for (const s of schoolStudents) {
            schoolStudentIds.add(s.id)
            if (s.matricula) schoolStudentIds.add(s.matricula)
          }
        } else {
          // Escola sem alunos cadastrados
          setRecords([])
          setIsLoading(false)
          return
        }
      }

      // 1. Buscar todos os cronogramas
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

      // 2. Agrupar por aluno_id: última data + contagem (filtrado pela escola se aplicável)
      const alunoMap = new Map<string, { lastDate: string; count: number }>()
      for (const c of cronogramas) {
        // Filtrar por escola do coordenador
        if (schoolStudentIds && !schoolStudentIds.has(c.aluno_id)) continue

        const existing = alunoMap.get(c.aluno_id)
        if (!existing) {
          alunoMap.set(c.aluno_id, { lastDate: c.created_at, count: 1 })
        } else {
          existing.count++
        }
      }

      if (alunoMap.size === 0) {
        setRecords([])
        setIsLoading(false)
        return
      }

      // 3. Separar UUIDs de matrículas
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const alunoIds = Array.from(alunoMap.keys())
      const uuidIds = alunoIds.filter(id => uuidRegex.test(id))
      const matriculaIds = alunoIds.filter(id => !uuidRegex.test(id))

      // Helper: normalizar turma — A-E → 3A-3E (3ª série)
      const normalizeTurma = (turma: string): string => {
        if (/^[A-E]$/i.test(turma)) return `3${turma.toUpperCase()}`
        return turma
      }

      type StudentRow = { id: string; name: string; matricula: string; turma: string; school_id: string }

      // 4. Buscar alunos de ambas as fontes em paralelo
      const [byUuidResult, byMatriculaResult] = await Promise.all([
        uuidIds.length > 0
          ? supabase.from('students').select('id, name, matricula, turma, school_id').in('id', uuidIds)
          : Promise.resolve({ data: null }),
        matriculaIds.length > 0
          ? supabase.from('students').select('id, name, matricula, turma, school_id').in('matricula', matriculaIds)
          : Promise.resolve({ data: null }),
      ])

      const studentsById = (byUuidResult.data || []) as StudentRow[]
      const studentsByMatricula = (byMatriculaResult.data || []) as StudentRow[]

      // 5. Coletar school_ids e resolver nomes via RPC (bypassa RLS)
      const allSchoolIds = new Set<string>()
      for (const s of studentsById) { if (s.school_id) allSchoolIds.add(s.school_id) }
      for (const s of studentsByMatricula) { if (s.school_id) allSchoolIds.add(s.school_id) }

      const schoolNameMap = new Map<string, string>()
      if (allSchoolIds.size > 0) {
        const { data: rpcSchools, error: rpcErr } = await supabase
          .rpc('get_school_names', { school_ids: Array.from(allSchoolIds) })

        if (!rpcErr && rpcSchools) {
          for (const s of rpcSchools as Array<{ id: string; name: string }>) {
            schoolNameMap.set(s.id, s.name)
          }
        } else {
          console.warn('[Audit] RPC get_school_names error:', rpcErr?.message)
        }
      }

      const getSchoolName = (schoolId: string | null): string => {
        if (schoolId && schoolNameMap.has(schoolId)) return schoolNameMap.get(schoolId)!
        return 'Sem escola'
      }

      const auditRecords: AuditRecord[] = []
      const resolved = new Set<string>()

      // 6. Resolver alunos por UUID
      for (const s of studentsById) {
        const info = alunoMap.get(s.id)
        if (!info) continue
        resolved.add(s.id)
        auditRecords.push({
          alunoId: s.id,
          nome: s.name || 'Sem nome',
          matricula: s.matricula || s.id,
          turma: normalizeTurma(s.turma || '-'),
          email: null,
          escola: getSchoolName(s.school_id),
          schoolId: s.school_id || null,
          lastCronogramaDate: new Date(info.lastDate),
          totalCronogramas: info.count,
        })
      }

      // 7. Resolver alunos por matrícula (aluno_id = matrícula, ex: Marista 2141xxxxx)
      for (const s of studentsByMatricula) {
        const info = alunoMap.get(s.matricula)
        if (!info || resolved.has(s.matricula)) continue
        resolved.add(s.matricula)
        auditRecords.push({
          alunoId: s.matricula,
          nome: s.name || 'Sem nome',
          matricula: s.matricula,
          turma: normalizeTurma(s.turma || '-'),
          email: null,
          escola: getSchoolName(s.school_id),
          schoolId: s.school_id || null,
          lastCronogramaDate: new Date(info.lastDate),
          totalCronogramas: info.count,
        })
      }

      // 8. Resolver UUIDs restantes via alunos_avulsos_cronograma
      const unresolvedUuids = uuidIds.filter(id => !resolved.has(id))
      if (unresolvedUuids.length > 0) {
        const { data: avulsos } = await supabase
          .from('alunos_avulsos_cronograma')
          .select('id, nome, matricula, turma, email')
          .in('id', unresolvedUuids)

        if (avulsos) {
          for (const s of avulsos) {
            const info = alunoMap.get(s.id)
            if (!info) continue
            resolved.add(s.id)
            auditRecords.push({
              alunoId: s.id,
              nome: s.nome || 'Sem nome',
              matricula: s.matricula || s.id,
              turma: s.turma || '-',
              email: s.email || null,
              escola: 'Aluno Avulso',
              schoolId: null,
              lastCronogramaDate: new Date(info.lastDate),
              totalCronogramas: info.count,
            })
          }
        }
      }

      // 9. Alunos não encontrados em nenhuma tabela
      for (const [alunoId, info] of alunoMap) {
        if (resolved.has(alunoId)) continue
        const isUuid = uuidRegex.test(alunoId)
        auditRecords.push({
          alunoId,
          nome: isUuid ? `Sem cadastro (${alunoId.slice(0, 8)}…)` : `Sem cadastro`,
          matricula: isUuid ? alunoId.slice(0, 13) + '…' : alunoId,
          turma: '-',
          email: null,
          escola: 'Sem cadastro',
          schoolId: null,
          lastCronogramaDate: new Date(info.lastDate),
          totalCronogramas: info.count,
        })
      }

      // 10. Deduplicar por matrícula — mesclar contagens e manter data mais recente
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
          // Manter a versão com mais informação
          if (existing.nome.startsWith('Sem cadastro') && !r.nome.startsWith('Sem cadastro')) {
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
      void loadAuditData()
    }
  }, [isOpen, records.length, coordinatorSchoolId])

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
      {variant === 'icon' ? (
        <div className="group/audit relative">
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#fde68a] bg-[#fffbeb] text-[#b45309] transition-colors hover:bg-[#fef3c7]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-32 -translate-x-1/2 rounded-xl bg-[#0f172a] px-3 py-2 text-center text-xs text-white opacity-0 shadow-lg transition-all duration-150 group-hover/audit:opacity-100">
            Auditoria
          </div>
        </div>
      ) : (
        <div className="group relative min-w-0">
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex h-12 w-full items-center gap-2.5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 text-left text-sm font-semibold text-[#b45309] transition-colors hover:bg-[#fef3c7]"
            title="Auditoria de cronogramas"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <span className="min-w-0 truncate">Auditoria</span>
          </button>
          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl bg-[#0f172a] px-3 py-2 text-xs text-white opacity-0 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            Abre a visão gerencial com alunos, versões e cronogramas criados.
          </div>
        </div>
      )}

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
