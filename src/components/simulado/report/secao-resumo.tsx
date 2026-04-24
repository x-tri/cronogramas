import type {
  SisuAnalysis,
  RoiArea,
  MapaHabilidades,
  ErroHabilidade,
  AreaSigla,
} from '../../../types/report'
import type { SimuladoResult } from '../../../types/supabase'
import { AREA_COLORS, AREA_NOMES, formatNota } from './constants'

interface SecaoResumoProps {
  readonly sisu: SisuAnalysis
  readonly mapaHabilidades: MapaHabilidades
  readonly simulado?: SimuladoResult
}

/** Conta erros por area a partir do mapa de habilidades */
function countErrosByArea(erros: ReadonlyArray<ErroHabilidade>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of erros) {
    counts[e.area] = (counts[e.area] ?? 0) + e.totalErros
  }
  return counts
}

const TOTAL_Q_PER_AREA = 45

export function SecaoResumo({ sisu, mapaHabilidades, simulado }: SecaoResumoProps) {
  const { notaPonderadaAtual, notaCorte, gap, vagas, pesos, roiPorArea, anoReferencia } = sisu

  const gapValue = gap ?? 0
  const errosByArea = countErrosByArea(mapaHabilidades.errosPorHabilidade)

  const triMap: Record<string, number | null> = {
    LC: simulado?.studentAnswer?.tri_lc ?? null,
    CH: simulado?.studentAnswer?.tri_ch ?? null,
    CN: simulado?.studentAnswer?.tri_cn ?? null,
    MT: simulado?.studentAnswer?.tri_mt ?? null,
  }

  const sortedRoi = [...roiPorArea].sort((a, b) => b.valorPontoFinal - a.valorPontoFinal)
  const topRoi = sortedRoi[0] as RoiArea | undefined
  const botRoi = sortedRoi[sortedRoi.length - 1] as RoiArea | undefined

  function getPesoForArea(sigla: AreaSigla): number | null {
    if (!pesos) return null
    switch (sigla) {
      case 'LC': return pesos.linguagens
      case 'CH': return pesos.cienciasHumanas
      case 'CN': return pesos.cienciasNatureza
      case 'MT': return pesos.matematica
    }
  }

  return (
    <div>
      <h3 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">
        Resumo
      </h3>

      {/* Grid: nota ponderada, nota de corte, gap, vagas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <div className="bg-[#f7f6f3] rounded-lg px-3 py-2">
          <span className="text-[9px] text-[#9ca3af] uppercase tracking-wider">Nota ponderada*</span>
          <p className="text-[18px] font-bold text-[#1d1d1f] tabular-nums leading-tight">
            {formatNota(notaPonderadaAtual)}
          </p>
        </div>
        <div className="bg-[#f7f6f3] rounded-lg px-3 py-2">
          <span className="text-[9px] text-[#9ca3af] uppercase tracking-wider">
            Nota de corte{anoReferencia != null ? ` (${anoReferencia})` : ''}
          </span>
          <p className="text-[18px] font-bold text-[#1d1d1f] tabular-nums leading-tight">
            {formatNota(notaCorte)}
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${gapValue < 0 ? 'bg-[#fef2f2]' : 'bg-[#f0fdf4]'}`}>
          <span className="text-[9px] text-[#9ca3af] uppercase tracking-wider">Gap</span>
          <p className={`text-[18px] font-bold tabular-nums leading-tight ${gapValue < 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
            {gapValue >= 0 ? '+' : ''}{formatNota(gapValue)}
          </p>
        </div>
        {vagas != null ? (
          <div className="bg-[#f7f6f3] rounded-lg px-3 py-2">
            <span className="text-[9px] text-[#9ca3af] uppercase tracking-wider">Vagas</span>
            <p className="text-[18px] font-bold text-[#1d1d1f] tabular-nums leading-tight">
              {vagas}
            </p>
          </div>
        ) : null}
      </div>

      {/* Legenda do asterisco */}
      <p className="text-[10px] text-[#9ca3af] italic mb-4">
        * Redação assumida como 900 na simulação SISU (simulado padrão não mede redação).
      </p>

      {/* Tabela: desempenho por area */}
      <h4 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-2">
        Desempenho por Area
      </h4>
      <div className="border border-[#e3e2e0] rounded-lg overflow-hidden mb-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#e3e2e0] bg-[#fafafa]">
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-2">Area</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-2 text-center">TRI</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-2 text-center">Acertos</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-2 text-center">Erros</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-2 text-center">Peso</th>
            </tr>
          </thead>
          <tbody>
            {(['LC', 'CH', 'CN', 'MT'] as const).map((sigla) => {
              const erros = errosByArea[sigla] ?? 0
              const peso = getPesoForArea(sigla)
              const cor = AREA_COLORS[sigla] ?? '#6b7280'

              return (
                <tr key={sigla} className="border-b border-[#f1f1ef] last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="text-[12px] font-bold" style={{ color: cor }}>
                      {AREA_NOMES[sigla] ?? sigla}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[12px] font-bold text-[#1d1d1f] tabular-nums">
                      {formatNota(triMap[sigla])}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[12px] text-[#1d1d1f] tabular-nums">
                      {TOTAL_Q_PER_AREA - erros}/{TOTAL_Q_PER_AREA}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[12px] text-[#ef4444] tabular-nums">{erros}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[12px] text-[#6b7280] tabular-nums">
                      {peso != null ? peso.toFixed(1) : '\u2014'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {pesos ? (
              <tr className="border-t border-[#e3e2e0]">
                <td className="px-3 py-2">
                  <span className="text-[12px] font-bold" style={{ color: AREA_COLORS['RED'] ?? '#8b5cf6' }}>
                    Redacao
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-[12px] text-[#9ca3af]">{'\u2014'}</td>
                <td className="px-3 py-2 text-center text-[12px] text-[#9ca3af]">{'\u2014'}</td>
                <td className="px-3 py-2 text-center text-[12px] text-[#9ca3af]">{'\u2014'}</td>
                <td className="px-3 py-2 text-center">
                  <span className="text-[12px] text-[#6b7280] tabular-nums">{pesos.redacao.toFixed(1)}</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Frase de ROI */}
      {topRoi && botRoi && botRoi.valorPontoFinal > 0 ? (
        <p className="text-[11px] text-[#6b7280] bg-[#f7f6f3] rounded-lg px-3 py-2">
          Cada +1 ponto TRI em{' '}
          <span className="font-semibold text-[#1d1d1f]">
            {AREA_NOMES[topRoi.sigla] ?? topRoi.area}
          </span>{' '}
          (peso {topRoi.peso}) vale{' '}
          <span className="font-semibold text-[#1d1d1f]">{topRoi.valorPontoFinal.toFixed(2)}</span>{' '}
          na nota final. Subir 10 pontos em{' '}
          <span className="font-semibold text-[#1d1d1f]">
            {AREA_NOMES[topRoi.sigla] ?? topRoi.area}
          </span>{' '}
          equivale a subir{' '}
          <span className="font-semibold text-[#1d1d1f]">
            {Math.round((topRoi.valorPontoFinal / botRoi.valorPontoFinal) * 10)}
          </span>{' '}
          pontos em{' '}
          <span className="font-semibold text-[#1d1d1f]">
            {AREA_NOMES[botRoi.sigla] ?? botRoi.area}
          </span>.
        </p>
      ) : null}
    </div>
  )
}
