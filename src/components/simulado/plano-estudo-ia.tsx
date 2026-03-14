import { useState } from 'react'
import type { PlanoEstudo } from '../../services/maritaca'

interface PlanoEstudoIAProps {
  plano: PlanoEstudo
  nomeAluno: string | null
  simuladoTitle?: string
  onClose: () => void
}

const PRIORIDADE_LABEL = {
  alta:  { label: 'Prioridade Alta',  bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]' },
  media: { label: 'Prioridade Média', bg: 'bg-[#fff7ed]', text: 'text-[#c2410c]' },
  baixa: { label: 'Prioridade Baixa', bg: 'bg-[#f0fdf4]', text: 'text-[#047857]' },
}

export function PlanoEstudoIA({ plano, nomeAluno, simuladoTitle = 'Simulado', onClose }: PlanoEstudoIAProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const nome = nomeAluno?.split(' ')[0] ?? 'Aluno(a)'

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const { createElement } = await import('react')
      const { pdf } = await import('@react-pdf/renderer')
      const { PlanoEstudoPDF } = await import('../pdf/plano-estudo-pdf')

      const doc = createElement(PlanoEstudoPDF, {
        plano,
        nomeAluno,
        simuladoTitle,
      })
      const blob = await pdf(doc).toBlob()
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
      <div className="flex items-start justify-between px-5 py-4 border-b border-[#e3e2e0] bg-gradient-to-r from-[#f7f6f3] to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0071e3] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#37352f]">Plano de Estudos — {nome}</h3>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Gerado por Maritaca Sabiá · IA especializada em ENEM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                PDF
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

      <div className="px-5 py-4 space-y-4">
        {/* Resumo */}
        <div className="bg-[#f0f7ff] rounded-lg px-4 py-3 border-l-2 border-l-[#0071e3]">
          <p className="text-[13px] text-[#1d4ed8] leading-relaxed">{plano.resumo}</p>
        </div>

        {/* Meta + distribuição */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-[#f7f6f3] rounded-lg px-3 py-2 border border-[#e3e2e0]">
            <svg className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[12px] text-[#6b7280]">
              <span className="font-medium text-[#37352f]">Semana: </span>{plano.semanas}
            </span>
          </div>
          {plano.metaTRI && (
            <div className="flex items-center gap-2 bg-[#f5f3ff] rounded-lg px-3 py-2 border border-[#ede9fe]">
              <svg className="w-3.5 h-3.5 text-[#8b5cf6] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-[12px] text-[#6b7280]">
                <span className="font-medium text-[#7c3aed]">Meta TRI: </span>{plano.metaTRI}
              </span>
            </div>
          )}
        </div>

        {/* Áreas */}
        <div className="space-y-3">
          {plano.porArea
            .slice()
            .sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.prioridade] - { alta: 0, media: 1, baixa: 2 }[b.prioridade]))
            .map((area) => {
              const prio = PRIORIDADE_LABEL[area.prioridade] ?? PRIORIDADE_LABEL.media
              return (
                <div key={area.area} className="rounded-lg border border-[#e3e2e0] overflow-hidden">
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#f7f6f3]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: area.cor }} />
                      <span className="text-[13px] font-semibold text-[#37352f]">{area.area}</span>
                      {area.nota && (
                        <span className="text-[11px] font-medium text-[#6b7280] bg-white border border-[#e3e2e0] rounded px-1.5 py-0.5">
                          TRI {area.nota}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${prio.bg} ${prio.text}`}>
                      {prio.label}
                    </span>
                  </div>

                  <div className="px-3.5 py-3 space-y-3">
                    {/* Tópicos */}
                    <div className="flex flex-wrap gap-1.5">
                      {area.topicos.map((t) => (
                        <span key={t} className="text-[11px] text-[#4b5563] bg-[#f1f1ef] rounded px-2 py-0.5 border border-[#e3e2e0]">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Estratégia */}
                    <p className="text-[12px] text-[#6b7280] leading-relaxed">
                      <span className="font-semibold text-[#37352f]">Estratégia: </span>
                      {area.estrategia}
                    </p>

                    {/* Ações concretas */}
                    {area.acoes && area.acoes.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-[#f1f1ef]">
                        <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Ações concretas</p>
                        {area.acoes.map((acao, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-[11px] text-[#0071e3] font-bold flex-shrink-0 mt-0.5">→</span>
                            <p className="text-[12px] text-[#4b5563] leading-relaxed">{acao}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>

        {/* Recomendação geral */}
        <div className="bg-[#f5f3ff] rounded-lg px-4 py-3 border-l-2 border-l-[#8b5cf6]">
          <p className="text-[11px] font-semibold text-[#7c3aed] uppercase tracking-wide mb-1">Recomendação Geral</p>
          <p className="text-[12px] text-[#5b21b6] leading-relaxed">{plano.recomendacaoGeral}</p>
        </div>

        <p className="text-[10px] text-[#c1c0bb] text-center pb-1">
          Plano gerado automaticamente com IA · Valide com seu professor
        </p>
      </div>
    </div>
  )
}
