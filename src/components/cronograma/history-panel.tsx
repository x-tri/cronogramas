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

  // Se só tem 1 versão ou nenhuma, não precisa mostrar o painel
  if (versions.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide shrink-0">Versões</span>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {versions.map((v) => {
          const isActive = v.id === currentCronograma?.id
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v)}
              className={`group flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 transition-all ${
                isActive
                  ? 'border-[#2563eb] bg-[#eff6ff]'
                  : 'border-[#e5e7eb] bg-white hover:border-[#93c5fd]'
              }`}
            >
              {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />}
              <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? 'text-[#2563eb]' : 'text-[#374151]'}`}>
                {fmt(v.semanaInicio)}–{fmt(v.semanaFim)}
              </span>
              <span className="text-[9px] text-[#94a3b8] whitespace-nowrap">
                {fmtFull(v.createdAt)}
              </span>
              {!isActive && (
                <span
                  onClick={(e) => handleDelete(e, v.id)}
                  className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 text-[#94a3b8] hover:text-red-500 transition-all cursor-pointer"
                  title="Excluir"
                >
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      {isLoading && (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent shrink-0" />
      )}
    </div>
  )
}
