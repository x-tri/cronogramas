import { useState } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getRepository } from '../../data/factory'
import type { Cronograma } from '../../types/domain'

type PdfDeps = [
  typeof import('@react-pdf/renderer'),
  typeof import('../pdf/schedule-pdf-document'),
]

let pdfDepsPromise: Promise<PdfDeps> | null = null

function loadPdfDeps() {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([
      import('@react-pdf/renderer'),
      import('../pdf/schedule-pdf-document'),
    ])
  }
  return pdfDepsPromise
}

function formatWeekRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', { ...opts, year: 'numeric' })}`
}

function formatCreatedAt(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function weekNumber(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  )
}

export function CronogramaHistoryList() {
  const versions = useCronogramaStore((s) => s.cronogramaVersions)
  const currentCronograma = useCronogramaStore((s) => s.cronograma)
  const isLoadingVersions = useCronogramaStore((s) => s.isLoadingVersions)
  const currentStudent = useCronogramaStore((s) => s.currentStudent)
  const officialSchedule = useCronogramaStore((s) => s.officialSchedule)
  const selectCronogramaVersion = useCronogramaStore((s) => s.selectCronogramaVersion)
  const deleteCronogramaVersion = useCronogramaStore((s) => s.deleteCronogramaVersion)

  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null)

  if (!currentStudent) return null

  async function handleOpenPdf(version: Cronograma) {
    if (!currentStudent) return
    setGeneratingPdf(version.id)

    try {
      const repo = getRepository()
      const [blocks, [{ pdf }, { SchedulePdfDocument }]] = await Promise.all([
        repo.blocos.getBlocos(version.id),
        loadPdfDeps(),
      ])

      const { createElement } = await import('react')
      const doc = createElement(SchedulePdfDocument, {
        student: currentStudent,
        weekStart: version.semanaInicio,
        weekEnd: version.semanaFim,
        officialSchedule,
        blocks,
        examTitle: null,
        triScores: null,
      })

      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Libera o objeto URL após 60s
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
    } finally {
      setGeneratingPdf(null)
    }
  }

  async function handleDeleteVersion(id: string) {
    setDeletingVersion(id)
    try {
      await deleteCronogramaVersion(id)
    } finally {
      setDeletingVersion(null)
      setConfirmDelete(null)
    }
  }

  async function handleSelectVersion(version: Cronograma) {
    setLoadingVersion(version.id)
    try {
      await selectCronogramaVersion(version.id)
    } finally {
      setLoadingVersion(null)
    }
  }

  const sorted = [...versions].sort(
    (a, b) => b.semanaInicio.getTime() - a.semanaInicio.getTime(),
  )

  return (
    <section className="max-w-4xl mx-auto px-6">
      {/* Título da seção */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6e6e73] to-[#3a3a3c] flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-apple-title text-[#1d1d1f]">Cronogramas Salvos</h2>
            <p className="text-sm text-[#86868b]">Histórico completo de semanas planejadas</p>
          </div>
        </div>

        {!isLoadingVersions && versions.length > 0 && (
          <span className="px-3 py-1 text-xs font-semibold bg-[#f1f1ef] text-[#6b6b67] rounded-full">
            {versions.length} {versions.length === 1 ? 'versão' : 'versões'}
          </span>
        )}
      </div>

      {/* Lista */}
      <div className="apple-card-elevated overflow-hidden">
        {isLoadingVersions ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="w-6 h-6 animate-spin text-[#0071e3]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-[#86868b]">Carregando histórico…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-[#f1f1ef] flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-[#a1a1a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#1d1d1f]">Nenhum cronograma salvo</p>
            <p className="text-xs text-[#86868b]">Adicione blocos ao kanban para salvar automaticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {sorted.map((version, index) => {
              const isActive = version.id === currentCronograma?.id
              const isArchived = version.status === 'arquivado'
              const isGenerating = generatingPdf === version.id
              const isLoading = loadingVersion === version.id
              const isDeleting = deletingVersion === version.id
              const isConfirming = confirmDelete === version.id
              const wk = weekNumber(version.semanaInicio)

              return (
                <div
                  key={version.id}
                  className={`
                    flex items-center gap-4 px-5 py-4 transition-colors
                    ${isActive ? 'bg-[#f0f7ff]' : 'hover:bg-[#fafafa]'}
                  `}
                >
                  {/* Número / indicador */}
                  <div className="flex-shrink-0 w-10 text-center">
                    {isActive ? (
                      <div className="w-8 h-8 mx-auto rounded-full bg-[#0071e3] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-[#a1a1a6]">
                        {String(sorted.length - index).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${isActive ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>
                        {formatWeekRange(version.semanaInicio, version.semanaFim)}
                      </span>
                      <span className="text-xs text-[#a1a1a6] font-mono">Sem. {wk}</span>

                      {isActive && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#0071e3] text-white rounded-full tracking-wide">
                          ATIVO
                        </span>
                      )}
                      {isArchived && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#f1f1ef] text-[#6b6b67] rounded-full">
                          Arquivado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#a1a1a6] mt-0.5">
                      Criado em {formatCreatedAt(version.createdAt)}
                    </p>
                    {version.observacoes && (
                      <p className="text-xs text-[#6b6b67] mt-0.5 truncate">{version.observacoes}</p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">

                    {/* Confirmação de delete inline */}
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#d32f2f] font-medium">Apagar?</span>
                        <button
                          onClick={() => handleDeleteVersion(version.id)}
                          disabled={isDeleting}
                          className="h-7 px-2.5 text-xs font-semibold text-white bg-[#d32f2f] hover:bg-[#b71c1c] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {isDeleting ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : 'Sim'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          disabled={isDeleting}
                          className="h-7 px-2.5 text-xs font-medium text-[#6b6b67] bg-[#f1f1ef] hover:bg-[#e5e5ea] rounded-lg transition-colors"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      /* Botão lixeira */
                      <button
                        onClick={() => setConfirmDelete(version.id)}
                        disabled={!!deletingVersion || !!generatingPdf || !!loadingVersion}
                        title="Apagar cronograma"
                        className="h-8 w-8 flex items-center justify-center text-[#a1a1a6] hover:text-[#d32f2f] hover:bg-[#fff0f0] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}

                    {/* Carregar no kanban */}
                    {!isActive && !isConfirming && (
                      <button
                        onClick={() => handleSelectVersion(version)}
                        disabled={isLoading || !!loadingVersion}
                        title="Carregar no kanban"
                        className="h-8 px-3 text-xs font-medium text-[#6b6b67] bg-[#f1f1ef] hover:bg-[#e5e5ea] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isLoading ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 6h16M4 10h16M4 14h16M4 18h7" />
                          </svg>
                        )}
                        Carregar
                      </button>
                    )}

                    {/* Abrir PDF */}
                    {!isConfirming && <button
                      onClick={() => handleOpenPdf(version)}
                      disabled={isGenerating || !!generatingPdf}
                      title="Abrir PDF"
                      className="h-8 px-3 text-xs font-medium text-white bg-[#1d1d1f] hover:bg-[#3a3a3c] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Gerando…
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          PDF
                        </>
                      )}
                    </button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
