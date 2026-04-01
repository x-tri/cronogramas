import { useState } from 'react'
import type { StudyReport } from '../../services/study-report'

interface StudyReportPanelProps {
  report: StudyReport
  nomeAluno: string | null
  simuladoTitle?: string
  onClose: () => void
}

const AREA_DOT: Record<string, string> = {
  cn: 'bg-[#10b981]',
  ch: 'bg-[#f97316]',
  lc: 'bg-[#3b82f6]',
  mt: 'bg-[#ef4444]',
  revisao: 'bg-[#8b5cf6]',
  pausa: 'bg-[#d1d0cb]',
}

const PRIO_STYLES: Record<string, { text: string; bg: string }> = {
  ALTA: { text: 'text-[#dc2626]', bg: 'bg-[#fef2f2]' },
  MEDIA: { text: 'text-[#d97706]', bg: 'bg-[#fffbeb]' },
  BAIXA: { text: 'text-[#6b7280]', bg: 'bg-[#f9fafb]' },
}
function buildCutoffHelper(report: StudyReport): string {
  if (!report.pesos.notaCorteReferencia) {
    return 'Sem corte disponível'
  }

  const modeLabel = report.pesos.notaCorteTipo === 'ampla_concorrencia' ? 'Ampla concorrência' : 'Modalidade de referência'
  const sourceLabel = report.pesos.notaCorteOrigem === 'aprovados_final' ? 'Final Cut Score' : 'Nota de corte'
  const parts = [`${sourceLabel} · ${modeLabel} · Ano ${report.pesos.notaCorteAno ?? '-'}`]

  if (
    report.pesos.maiorNotaConvocadoAmostra != null
    && report.pesos.menorNotaConvocadoAmostra != null
  ) {
    parts.push(`Maior nota: ${report.pesos.maiorNotaConvocadoAmostra.toFixed(2)}`)
    parts.push(`Menor nota: ${report.pesos.menorNotaConvocadoAmostra.toFixed(2)}`)
  }

  return parts.join(' | ')
}

function areaPriorityClass(priority: 'ALTA' | 'MEDIA' | 'BAIXA'): string {
  if (priority === 'ALTA') return 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
  if (priority === 'MEDIA') return 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
  return 'bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]'
}

export function StudyReportPanel({ report, nomeAluno, simuladoTitle = 'Simulado', onClose }: StudyReportPanelProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { StudyReportPDF } = await import('../pdf/study-report-pdf')
      const doc = createElement(StudyReportPDF, { report, nomeAluno, simuladoTitle })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio-estudos-${(nomeAluno ?? 'aluno').toLowerCase().replace(/\s+/g, '-')}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e3e2e0] bg-white">
      <div className="border-b border-[#e3e2e0] bg-white px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-bold leading-tight text-[#1d1d1f]">Relatório de Estudos por Objetivo</h2>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              XTRI{nomeAluno ? ` | ${nomeAluno}` : ''} · {hoje}
            </p>
          </div>
          <div className="ml-4 flex flex-shrink-0 items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 rounded-md border border-[#0071e3]/30 px-3 py-1.5 text-[12px] font-medium text-[#0071e3] transition-colors hover:bg-[#f0f7ff] disabled:opacity-50"
            >
              {isGeneratingPdf ? 'Gerando…' : 'Baixar PDF'}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-[#9ca3af] transition-colors hover:bg-[#f1f1ef] hover:text-[#37352f]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl border border-[#dbe5f3] bg-[#f8fbff] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748b]">Objetivo selecionado</p>
          <p className="mt-2 text-sm font-semibold text-[#0f172a]">
            {report.objetivo.curso} · {report.objetivo.universidade}
          </p>
          <p className="mt-1 text-xs text-[#64748b]">
            {report.objetivo.cidade}/{report.objetivo.estado}
            {report.objetivo.campus ? ` · ${report.objetivo.campus}` : ''}
            {report.objetivo.turno ? ` · ${report.objetivo.turno}` : ''}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <WeightCard label="Linguagens" value={report.pesos.linguagens} />
          <WeightCard label="Humanas" value={report.pesos.humanas} />
          <WeightCard label="Natureza" value={report.pesos.natureza} />
          <WeightCard label="Matemática" value={report.pesos.matematica} />
          <WeightCard label="Redação" value={report.pesos.redacao} />
          <WeightCard
            label="Corte Final"
            value={report.pesos.notaCorteReferencia}
            helper={buildCutoffHelper(report)}
          />
        </div>

        <div className="border-l-[3px] border-l-[#0071e3] pl-3.5">
          <p className="mb-1 text-[11px] font-bold text-[#1d1d1f]">Estratégia:</p>
          <p className="text-[12px] leading-relaxed text-[#374151]">{report.estrategia}</p>
        </div>

        <div className="rounded-lg border border-[#e3e2e0] bg-[#fafafa] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d1d1f]">Melhorias nas 4 áreas</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {report.melhoriasAreas.map((item) => (
              <div key={item.area} className="rounded-lg border border-[#e3e2e0] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#0f172a]">{item.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${areaPriorityClass(item.prioridade)}`}>
                    {item.prioridade}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#64748b]">
                  TRI atual: {item.triScore != null ? Math.round(item.triScore) : '-'} · Peso SISU: {item.pesoSisu.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#334155]">Foco: {item.topicoFoco}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">{item.acao}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-[#e3e2e0] p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#1d1d1f]">Diagnóstico do aluno</p>
          <InfoLine label="Pontos fracos" value={report.diagnostico.pontosFracos.join(', ')} tone="danger" />
          <InfoLine label="Pontos fortes" value={report.diagnostico.pontosFortes.join(', ')} tone="success" />
          <InfoLine label="Meta do próximo simulado" value={report.diagnostico.metaProximoSimulado} tone="info" />
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e3e2e0]">
          <div className="grid grid-cols-[80px_1fr_64px] gap-px border-b border-[#e3e2e0] bg-[#f7f6f3] px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Horário</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Atividade</span>
            <span className="text-right text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Prioridade</span>
          </div>

          {report.atividades.map((atividade, index) => {
            const isPausa = atividade.area === 'pausa'
            const prio = PRIO_STYLES[atividade.prioridade] ?? PRIO_STYLES.BAIXA
            const dot = AREA_DOT[atividade.area] ?? 'bg-[#9ca3af]'

            return (
              <div
                key={index}
                className={`grid grid-cols-[80px_1fr_64px] gap-2 border-b border-[#f1f1ef] px-4 py-3 last:border-b-0 ${isPausa ? 'bg-[#fafafa]' : 'bg-white'}`}
              >
                <div className="flex items-start gap-2 pt-0.5">
                  <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                  <span className={`text-[11px] leading-tight tabular-nums ${isPausa ? 'italic text-[#9ca3af]' : 'text-[#6b7280]'}`}>
                    {atividade.horario}
                  </span>
                </div>
                <div>
                  <p className={`mb-1 text-[12px] leading-snug ${isPausa ? 'font-normal italic text-[#9ca3af]' : 'font-semibold text-[#1d1d1f]'}`}>
                    {atividade.titulo}
                  </p>
                  <p className={`mb-1.5 text-[11px] leading-relaxed ${isPausa ? 'italic text-[#9ca3af]' : 'text-[#4b5563]'}`}>
                    {atividade.descricao}
                  </p>
                  {atividade.dica ? (
                    <p className={`text-[11px] italic leading-snug ${isPausa ? 'text-[#10b981]' : 'text-[#0071e3]'}`}>
                      <span className="font-medium">Dica:</span> {atividade.dica}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end items-start pt-0.5">
                  {!isPausa ? (
                    <span className={`text-[10px] font-bold tracking-wide ${prio.text}`}>
                      {atividade.prioridade}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border border-[#e3e2e0] bg-[#fafafa] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d1d1f]">Base usada no relatório</p>
          <p className="mt-2 text-[11px] text-[#4b5563]">{report.referencias.metodologia}</p>
          <p className="mt-1 text-[11px] text-[#64748b]">{report.referencias.baseHistorica}</p>
          {report.referencias.habilidadesOficiais.length > 0 ? (
            <div className="mt-3 space-y-1">
              {report.referencias.habilidadesOficiais.slice(0, 4).map((habilidade) => (
                <p key={habilidade} className="text-[11px] text-[#475569]">• {habilidade}</p>
              ))}
            </div>
          ) : null}
        </div>

        <p className="pb-1 text-center text-[10px] text-[#c1c0bb]">
          Relatório determinístico com base em resultados do simulado, pesos SISU e conteúdos históricos do ENEM. · {simuladoTitle}
        </p>
      </div>
    </div>
  )
}

function WeightCard({ label, value, helper }: { label: string; value: number | null; helper?: string }) {
  return (
    <div className="rounded-xl border border-[#e3e2e0] bg-white px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#0f172a]">{value != null ? value.toFixed(2) : '-'}</p>
      {helper ? <p className="mt-1 text-[11px] text-[#64748b]">{helper}</p> : null}
    </div>
  )
}

function InfoLine({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'success' | 'info' }) {
  const color = {
    danger: 'text-[#dc2626]',
    success: 'text-[#059669]',
    info: 'text-[#1d4ed8]',
  }[tone]

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="whitespace-nowrap text-[12px] font-semibold text-[#1d1d1f]">{label}:</span>
      <span className={`text-[12px] leading-relaxed ${color}`}>{value}</span>
    </div>
  )
}
