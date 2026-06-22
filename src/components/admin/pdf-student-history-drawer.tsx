/**
 * PdfStudentHistoryDrawer — histórico completo de documentos PDF de um aluno
 * (cronogramas semanais, relatórios de desempenho, cadernos de questões).
 *
 * Aberto ao clicar no nome do aluno na auditoria de downloads (admin-pdfs.tsx).
 * Recebe os records já carregados pela tela (sem query nova) e filtra por
 * aluno — RLS de pdf_history já limita o mentor à própria escola.
 *
 * "Baixar tudo" baixa os PDFs em sequência (decisão de escopo: sem zip/merge).
 */

import { useEffect, useState, type ReactElement } from 'react'

import { getSignedPdfUrl } from '../../services/pdf-storage'
import { copyPdfLink, downloadPdfFile, fetchBlobFromUrl } from './pdf-actions'
import { saveBlobsAsZip } from '../../lib/zip-download'
import { downloadAllAsZip, selectStudentHistory } from './pdf-student-history'
import { PDF_TYPE_LABELS, formatFileSize, type PdfRecord } from './pdf-types'
import { formatDateShortBR as formatDate } from '../../lib/format-date'

export interface PdfStudentHistoryDrawerProps {
  readonly open: boolean
  readonly alunoId: string | null
  readonly records: readonly PdfRecord[]
  readonly onClose: () => void
}


export function PdfStudentHistoryDrawer({
  open,
  alunoId,
  records,
  onClose,
}: PdfStudentHistoryDrawerProps): ReactElement | null {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    // Limpa estados transitórios ao trocar de aluno/reabrir
    setProgress(null)
    setResultMessage(null)
  }, [alunoId, open])

  if (!open || !alunoId) return null

  const history = selectStudentHistory(records, alunoId)
  const student = history[0] ?? null
  const downloadedCount = history.filter((r) => r.download_count > 0).length
  const zipFilename = `documentos-${student?.matricula ?? 'aluno'}-${new Date().toISOString().slice(0, 10)}.zip`

  async function handleDownloadAll() {
    setDownloading(true)
    setResultMessage(null)
    try {
      const { ok, failed } = await downloadAllAsZip(history, {
        getUrl: (path, filename) => getSignedPdfUrl(path, undefined, { downloadAs: filename }),
        // ZIP único: evita bloqueio/renomeação incorreta de múltiplos downloads
        // programáticos no Chrome e preserva o nome real de cada PDF.
        fetchBlob: fetchBlobFromUrl,
        saveZip: saveBlobsAsZip,
        zipFilename,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setResultMessage(
        failed === 0
          ? `${ok} documento${ok === 1 ? '' : 's'} no ZIP.`
          : `${ok} de ${history.length} no ZIP (${failed} falhar${failed === 1 ? 'am' : 'am'}).`,
      )
    } finally {
      setDownloading(false)
      setProgress(null)
    }
  }

  async function handleDownloadOne(record: PdfRecord) {
    await downloadPdfFile(record.storage_path, record.filename)
  }

  async function handleCopyLink(record: PdfRecord) {
    await copyPdfLink(record.storage_path, record.filename)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de documentos do aluno"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#e5e7eb] bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
              Histórico de documentos
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1d1d1f]">
              {student?.aluno_nome ?? 'Aluno'}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              {student?.turma ? `Turma ${student.turma}` : 'Turma -'}
              {student?.matricula ? ` · ${student.matricula}` : ''}
              {` · ${history.length} documento${history.length === 1 ? '' : 's'}`}
              {history.length > 0 ? ` · ${downloadedCount} de ${history.length} baixados pelo aluno` : ''}
            </p>
          </div>
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

        {/* Baixar tudo */}
        {history.length > 0 && (
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] bg-[#f8fafc] px-6 py-3">
            <button
              onClick={() => void handleDownloadAll()}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading && progress
                ? `Baixando ${progress.done}/${progress.total}...`
                : `Baixar tudo (.zip)`}
            </button>
            {resultMessage && (
              <span className="text-xs text-[#64748b]">{resultMessage}</span>
            )}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#94a3b8]">
              Nenhum documento gerado para este aluno ainda.
            </p>
          ) : (
            <ul className="divide-y divide-[#f1f5f9]">
              {history.map((record) => (
                <li key={record.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1d1d1f]">
                      {PDF_TYPE_LABELS[record.tipo] ?? record.tipo.replace('_', ' ')}
                    </p>
                    <p className="mt-0.5 text-xs text-[#94a3b8]">
                      {formatDate(record.created_at)} · {formatFileSize(record.file_size)}
                    </p>
                  </div>
                  {record.download_count > 0 ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#166534]"
                      title={`Baixou em ${record.first_downloaded_at ? new Date(record.first_downloaded_at).toLocaleString('pt-BR') : '-'}`}
                    >
                      ✓ Baixou
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-medium text-[#9a3412]">
                      Nao baixou
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => void handleDownloadOne(record)}
                      className="rounded p-1.5 text-[#2563eb] transition-colors hover:bg-[#dbeafe]"
                      title="Baixar"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => void handleCopyLink(record)}
                      className="rounded p-1.5 text-[#64748b] transition-colors hover:bg-[#f1f5f9]"
                      title="Copiar link (válido por 1 hora)"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
