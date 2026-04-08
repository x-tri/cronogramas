import type { CursoEncontrado } from '../../../types/report'
import { formatNota } from './constants'

interface ReportHeaderProps {
  readonly nomeAluno: string
  readonly curso: CursoEncontrado | null
  readonly notaCorte: number | null
  readonly gap: number | null
  readonly computedAt: string
  readonly onDownloadRelatorio?: () => void
  readonly onDownloadQuestoes?: () => void
  readonly isGeneratingRelatorio?: boolean
  readonly isGeneratingQuestoes?: boolean
}

export function ReportHeader({
  nomeAluno,
  curso,
  notaCorte,
  gap,
  computedAt,
  onDownloadRelatorio,
  onDownloadQuestoes,
  isGeneratingRelatorio = false,
  isGeneratingQuestoes = false,
}: ReportHeaderProps) {
  const dataFormatada = new Date(computedAt).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const gapValue = gap ?? 0
  const isNegativeGap = gapValue < 0

  return (
    <div className="bg-[#1d1d1f] px-5 py-5 text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold leading-tight tracking-tight">
            Relatorio de Desempenho ENEM
          </h2>
          <p className="text-[14px] text-white/90 mt-1 font-medium truncate">
            {nomeAluno}
          </p>
          {curso ? (
            <p className="text-[12px] text-white/60 mt-0.5 truncate">
              {curso.nome} — {curso.universidade}
              {curso.campus ? ` (${curso.campus})` : ''}
              {curso.estado ? ` — ${curso.estado}` : ''}
            </p>
          ) : null}
          <p className="text-[10px] text-white/40 mt-1.5">{dataFormatada}</p>
        </div>

        {/* Gap badge + nota de corte */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {notaCorte != null ? (
            <div className="text-right">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Nota de corte</span>
              <p className="text-[20px] font-bold text-white/80 tabular-nums leading-tight">
                {formatNota(notaCorte)}
              </p>
            </div>
          ) : null}
          {gap != null ? (
            <div
              className={`rounded-lg px-3 py-2 ${
                isNegativeGap ? 'bg-[#ef4444]' : 'bg-[#10b981]'
              }`}
            >
              <span className="text-[10px] text-white/80 uppercase tracking-wider font-medium">Gap</span>
              <p className="text-[20px] font-bold text-white tabular-nums leading-tight">
                {gapValue >= 0 ? '+' : ''}{formatNota(gapValue)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Botoes de PDF */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {onDownloadRelatorio ? (
          <PdfButton
            onClick={onDownloadRelatorio}
            isGenerating={isGeneratingRelatorio}
            label="Baixar Relatorio PDF"
            loadingLabel="Gerando..."
          />
        ) : null}
        {onDownloadQuestoes ? (
          <PdfButton
            onClick={onDownloadQuestoes}
            isGenerating={isGeneratingQuestoes}
            label="Baixar Caderno de Questoes PDF"
            loadingLabel="Gerando..."
          />
        ) : null}
      </div>
    </div>
  )
}

// -- Botao auxiliar --

interface PdfButtonProps {
  readonly onClick: () => void
  readonly isGenerating: boolean
  readonly label: string
  readonly loadingLabel: string
}

function PdfButton({ onClick, isGenerating, label, loadingLabel }: PdfButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white border border-white/30 hover:bg-white/10 transition-colors disabled:opacity-50"
    >
      {isGenerating ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
