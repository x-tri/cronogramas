import type {
  HabilidadeCritica,
  RoiArea,
  AreaSigla,
  SisuAnalysis,
} from '../../../types/report'
import type { SimuladoResult } from '../../../types/supabase'
import {
  AREA_COLORS,
  AREA_NOMES,
  formatNota,
  formatPercent,
  getPrioridadeFromScore,
  formatDificuldadeSimples,
} from './constants'

interface SecaoInvestirProps {
  readonly habilidades: ReadonlyArray<HabilidadeCritica>
  readonly sisu: SisuAnalysis
  readonly simulado?: SimuladoResult
}

/** Agrupa habilidades por area, ordenadas por total de erros do grupo */
function groupHabsByArea(
  habs: ReadonlyArray<HabilidadeCritica>,
): ReadonlyArray<{ area: AreaSigla; totalErros: number; items: ReadonlyArray<HabilidadeCritica> }> {
  const sorted = [...habs].sort((a, b) => b.score - a.score)
  const map = new Map<AreaSigla, HabilidadeCritica[]>()

  for (const h of sorted) {
    const existing = map.get(h.area)
    if (existing) {
      existing.push(h)
    } else {
      map.set(h.area, [h])
    }
  }

  return [...map.entries()]
    .sort((a, b) =>
      b[1].reduce((s, h) => s + h.totalErros, 0) - a[1].reduce((s, h) => s + h.totalErros, 0),
    )
    .map(([area, items]) => ({
      area,
      totalErros: items.reduce((s, h) => s + h.totalErros, 0),
      items,
    }))
}

export function SecaoInvestir({ habilidades, sisu, simulado }: SecaoInvestirProps) {
  if (habilidades.length === 0) return null

  const groupedHabs = groupHabsByArea(habilidades)
  const sortedRoi = [...sisu.roiPorArea].sort((a, b) => b.valorPontoFinal - a.valorPontoFinal)
  const gapValue = sisu.gap ?? 0

  const triMap: Record<string, number | null> = {
    LC: simulado?.studentAnswer?.tri_lc ?? null,
    CH: simulado?.studentAnswer?.tri_ch ?? null,
    CN: simulado?.studentAnswer?.tri_cn ?? null,
    MT: simulado?.studentAnswer?.tri_mt ?? null,
  }

  return (
    <div>
      <h3 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-1">
        Onde Investir
      </h3>
      <p className="text-[11px] text-[#6b7280] mb-4">
        Conteudos organizados por area, priorizados pelo cruzamento entre erros do simulado e incidencia historica no ENEM (2010-2024). Foque nos conteudos de maior prioridade das areas com maior peso SISU.
      </p>

      <div className="space-y-5">
        {groupedHabs.map(({ area, totalErros, items }) => {
          const triAtual = triMap[area] ?? null
          const peso = sortedRoi.find((r) => r.sigla === area) as RoiArea | undefined
          const cor = AREA_COLORS[area] ?? '#9ca3af'

          return (
            <AreaBlock
              key={area}
              area={area}
              totalErros={totalErros}
              items={items}
              triAtual={triAtual}
              peso={peso}
              cor={cor}
              gapValue={gapValue}
              notaCorte={sisu.notaCorte}
            />
          )
        })}
      </div>
    </div>
  )
}

// -- Sub-componente por area --

interface AreaBlockProps {
  readonly area: AreaSigla
  readonly totalErros: number
  readonly items: ReadonlyArray<HabilidadeCritica>
  readonly triAtual: number | null
  readonly peso: RoiArea | undefined
  readonly cor: string
  readonly gapValue: number
  readonly notaCorte: number | null
}

function AreaBlock({ area, totalErros, items, triAtual, peso, cor, gapValue, notaCorte }: AreaBlockProps) {
  const areaNome = AREA_NOMES[area] ?? area

  return (
    <div>
      {/* Header da area */}
      <div className="flex items-center gap-2 pb-2 border-b border-[#e3e2e0]">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: cor }}>
          {areaNome}
        </span>
        <span className="text-[11px] text-[#6b7280]">
          — {totalErros} erros
        </span>
        {triAtual != null ? (
          <span className="text-[11px] font-bold text-[#1d1d1f] ml-auto">
            TRI: {formatNota(triAtual)}
          </span>
        ) : null}
      </div>

      {/* Texto contextual */}
      <p className="text-[11px] text-[#374151] mt-2 mb-2 leading-relaxed">
        {peso ? (
          <>
            Peso SISU: <span className="font-semibold">{peso.peso}</span> (cada +1 pt TRI ={' '}
            <span className="font-semibold">+{peso.valorPontoFinal.toFixed(2)}</span> na nota final).{' '}
          </>
        ) : null}
        Voce errou {totalErros} questoes nesta area.
        {triAtual != null && notaCorte != null ? (
          <>
            {' '}Sua TRI atual ({formatNota(triAtual)}) precisa subir para contribuir com o fechamento do gap de{' '}
            {formatNota(Math.abs(gapValue))} pontos.
          </>
        ) : null}
      </p>

      {/* Tabela de conteudos */}
      <div className="border border-[#e3e2e0] rounded-lg overflow-hidden mb-2">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#e3e2e0] bg-[#fafafa]">
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-1.5">Conteudo</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-1.5 text-center w-14">Erros</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-1.5 text-center w-16">Incid.</th>
              <th className="text-[9px] text-[#9ca3af] uppercase tracking-wider font-bold px-3 py-1.5 text-right w-16">Prio.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((hab) => {
              const prio = getPrioridadeFromScore(hab.score)
              return (
                <tr key={hab.identificador} className="border-b border-[#f1f1ef] last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="text-[11px] text-[#1d1d1f]">
                      {hab.pedagogicalLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[11px] text-[#6b7280] tabular-nums">{hab.totalErros}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[11px] text-[#6b7280] tabular-nums">{formatPercent(hab.percentualIncidencia)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${prio.classes}`}>
                      {prio.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Questoes recomendadas inline */}
      <QuestoesInline items={items} />
    </div>
  )
}

// -- Questoes recomendadas inline --

/** Trunca enunciado para preview (primeiros 100 chars) */
function truncateEnunciado(text: string, max = 100): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '...'
}

function QuestoesInline({ items }: { readonly items: ReadonlyArray<HabilidadeCritica> }) {
  const habsComQuestoes = items.filter((h) => h.questoesRecomendadas.length > 0)
  if (habsComQuestoes.length === 0) return null

  return (
    <div className="mt-1 space-y-1">
      <span className="text-[10px] font-medium text-[#9ca3af]">Questoes para treino:</span>
      {habsComQuestoes.map((h) => {
        const label = h.pedagogicalLabel
        const qs = h.questoesRecomendadas.slice(0, 3)
        return (
          <div key={h.identificador} className="text-[10px] text-[#6b7280] leading-relaxed">
            <span className="font-medium text-[#374151]">{label}</span>
            {' \u2192 '}
            {qs.map((q, i) => (
              <span key={`${h.identificador}-${q.ano}-${q.posicaoCaderno ?? q.coItem}-${i}`}>
                {i > 0 ? ', ' : ''}
                ENEM {q.ano} ({formatDificuldadeSimples(q.dificuldade)})
                {q.enunciado ? (
                  <span className="text-[9px] text-[#9ca3af] italic ml-1">
                    &mdash; {truncateEnunciado(q.enunciado)}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
