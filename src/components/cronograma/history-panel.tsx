import { useCronogramaStore } from '../../stores/cronograma-store'
import type { Cronograma } from '../../types/domain'
import { ESCOLA_LABELS } from '../../types/domain'

export function HistoryPanel() {
  const currentStudent = useCronogramaStore((s) => s.currentStudent)
  const versions = useCronogramaStore((s) => s.cronogramaVersions)
  const currentCronograma = useCronogramaStore((s) => s.cronograma)
  const isLoading = useCronogramaStore((s) => s.isLoadingVersions)
  const selectVersion = useCronogramaStore((s) => s.selectCronogramaVersion)
  const deleteVersion = useCronogramaStore((s) => s.deleteCronogramaVersion)

  const studentInitials = currentStudent
    ? currentStudent.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : ''
  const schoolName = currentStudent?.escolaNome?.trim() || (currentStudent ? ESCOLA_LABELS[currentStudent.escola] : '')

  const handleSelect = (version: Cronograma) => {
    selectVersion(version.id)
  }

  const handleDelete = async (e: React.MouseEvent, versionId: string) => {
    e.stopPropagation()
    if (!window.confirm('Excluir este cronograma? Os blocos serão removidos.')) return
    try { await deleteVersion(versionId) } catch (err) { console.error(err) }
  }

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const fmtFull = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  if (!currentStudent) return null

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-3 mb-3">
      {/* Student info + title row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white leading-none">{studentInitials}</span>
          </div>
          {/* Name & meta */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1d1d1f] truncate">{currentStudent.nome}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#f1f5f9] text-[#64748b] rounded">
                {currentStudent.matricula}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#94a3b8]">{schoolName}</span>
              {currentStudent.turma && (
                <>
                  <span className="text-[#d1d5db]">·</span>
                  <span className="text-[11px] text-[#94a3b8]">Turma {currentStudent.turma}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {versions.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#e0f2fe] text-[#2563eb] rounded-full">
              {versions.length} {versions.length === 1 ? 'versão' : 'versões'}
            </span>
          )}
          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
          )}
        </div>
      </div>

      {/* Horizontal scroll of version cards */}
      {versions.length > 0 && (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {versions.map((v) => {
          const isActive = v.id === currentCronograma?.id
          const isArchived = v.status === 'arquivado'

          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v)}
              className={`
                flex-shrink-0 relative group rounded-lg border px-3 py-2 text-left transition-all min-w-[140px]
                ${isActive
                  ? 'border-[#2563eb] bg-[#eff6ff] ring-1 ring-[#2563eb]/30'
                  : 'border-[#e5e7eb] bg-[#fafafa] hover:border-[#93c5fd] hover:bg-white'
                }
              `}
            >
              {/* Delete button */}
              {!isActive && (
                <span
                  onClick={(e) => handleDelete(e, v.id)}
                  className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-[#94a3b8] hover:text-red-500 transition-all cursor-pointer"
                  title="Excluir"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              )}

              {/* Week range */}
              <div className="flex items-center gap-1.5">
                {isActive && <span className="w-1.5 h-1.5 bg-[#2563eb] rounded-full flex-shrink-0" />}
                <span className={`text-xs font-semibold ${isActive ? 'text-[#2563eb]' : 'text-[#1d1d1f]'}`}>
                  {fmt(v.semanaInicio)} – {fmt(v.semanaFim)}
                </span>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-[#94a3b8]">
                  {fmtFull(v.createdAt)}
                </span>
                {isArchived && (
                  <span className="px-1 py-0.5 bg-[#f1f5f9] text-[#64748b] text-[9px] rounded font-medium">
                    Arquivado
                  </span>
                )}
                {isActive && (
                  <span className="px-1 py-0.5 bg-[#dbeafe] text-[#2563eb] text-[9px] rounded font-medium">
                    Atual
                  </span>
                )}
              </div>

              {/* Observações */}
              {v.observacoes && (
                <div className="text-[10px] text-[#64748b] mt-1 line-clamp-1">
                  {v.observacoes}
                </div>
              )}
            </button>
          )
        })}
      </div>
      )}
    </div>
  )
}
