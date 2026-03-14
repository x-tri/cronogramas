import { useState } from 'react'
import type { PlanoEstudo } from '../../services/maritaca'

interface PlanoEstudoIAProps {
  plano: PlanoEstudo
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
  ALTA:  { text: 'text-[#dc2626]', bg: 'bg-[#fef2f2]' },
  MEDIA: { text: 'text-[#d97706]', bg: 'bg-[#fffbeb]' },
  BAIXA: { text: 'text-[#6b7280]', bg: 'bg-[#f9fafb]' },
}

export function PlanoEstudoIA({ plano, nomeAluno, simuladoTitle = 'Simulado', onClose }: PlanoEstudoIAProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { PlanoEstudoPDF } = await import('../pdf/plano-estudo-pdf')
      const doc = createElement(PlanoEstudoPDF, { plano, nomeAluno, simuladoTitle })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `plano-estudos-${(nomeAluno ?? 'aluno').toLowerCase().replace(/\s+/g, '-')}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e3e2e0] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e3e2e0] bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#1d1d1f] leading-tight">Plano de Estudos Personalizado</h2>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              Gerado por IA - XTRI{nomeAluno ? ` | ${nomeAluno}` : ''} · {hoje}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[#0071e3] border border-[#0071e3]/30 hover:bg-[#f0f7ff] transition-colors disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Gerando…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#9ca3af] hover:text-[#37352f] hover:bg-[#f1f1ef] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Estratégia */}
        <div className="border-l-[3px] border-l-[#0071e3] pl-3.5">
          <p className="text-[11px] font-bold text-[#1d1d1f] mb-1">Estrategia:</p>
          <p className="text-[12px] text-[#374151] leading-relaxed">{plano.estrategia}</p>
        </div>

        {/* Diagnóstico */}
        <div className="border border-[#e3e2e0] rounded-lg p-4 space-y-2">
          <p className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">Diagnostico do Aluno</p>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-[#1d1d1f] whitespace-nowrap">Pontos fracos:</span>
            <span className="text-[12px] text-[#dc2626] leading-relaxed">{plano.diagnostico.pontosFracos.join(', ')}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-[#1d1d1f] whitespace-nowrap">Pontos fortes:</span>
            <span className="text-[12px] text-[#059669] leading-relaxed">{plano.diagnostico.pontosFortes.join(', ')}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-[#1d1d1f] whitespace-nowrap">Meta próximo simulado:</span>
            <span className="text-[12px] text-[#1d4ed8] leading-relaxed">{plano.diagnostico.metaProximoSimulado}</span>
          </div>
        </div>

        {/* Tabela de atividades */}
        <div className="border border-[#e3e2e0] rounded-lg overflow-hidden">
          {/* Header da tabela */}
          <div className="grid grid-cols-[80px_1fr_64px] gap-px bg-[#f7f6f3] px-4 py-2.5 border-b border-[#e3e2e0]">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Horário</span>
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">Atividade</span>
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider text-right">Prioridade</span>
          </div>

          {/* Linhas */}
          {plano.atividades.map((ativ, i) => {
            const isPausa = ativ.area === 'pausa'
            const prio = PRIO_STYLES[ativ.prioridade] ?? PRIO_STYLES.BAIXA
            const dot = AREA_DOT[ativ.area] ?? 'bg-[#9ca3af]'

            return (
              <div
                key={i}
                className={`grid grid-cols-[80px_1fr_64px] gap-2 px-4 py-3 border-b border-[#f1f1ef] last:border-b-0 ${isPausa ? 'bg-[#fafafa]' : 'bg-white'}`}
              >
                {/* Horário */}
                <div className="flex items-start gap-2 pt-0.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                  <span className={`text-[11px] tabular-nums leading-tight ${isPausa ? 'text-[#9ca3af] italic' : 'text-[#6b7280]'}`}>
                    {ativ.horario}
                  </span>
                </div>

                {/* Conteúdo */}
                <div>
                  <p className={`text-[12px] font-semibold mb-1 leading-snug ${isPausa ? 'text-[#9ca3af] italic font-normal' : 'text-[#1d1d1f]'}`}>
                    {ativ.titulo}
                  </p>
                  <p className={`text-[11px] leading-relaxed mb-1.5 ${isPausa ? 'text-[#9ca3af] italic' : 'text-[#4b5563]'}`}>
                    {ativ.descricao}
                  </p>
                  {ativ.dica && (
                    <p className={`text-[11px] italic leading-snug ${isPausa ? 'text-[#10b981]' : 'text-[#0071e3]'}`}>
                      <span className="font-medium">Dica:</span> {ativ.dica}
                    </p>
                  )}
                </div>

                {/* Prioridade */}
                <div className="flex justify-end items-start pt-0.5">
                  {!isPausa && (
                    <span className={`text-[10px] font-bold tracking-wide ${prio.text}`}>
                      {ativ.prioridade}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[#c1c0bb] text-center pb-1">
          Gerado automaticamente pela IA do XTRI · Plano personalizado com base nos seus resultados de simulado.
        </p>
      </div>
    </div>
  )
}
