import type { PerfilAprovados } from '../../../types/report'
import { formatNota } from './constants'

interface SecaoAprovadosDetalhadoProps {
  readonly perfil: PerfilAprovados
  readonly notaAtual: number | null
}

export function SecaoAprovadosDetalhado({ perfil, notaAtual }: SecaoAprovadosDetalhadoProps) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-1">
        Perfil dos Aprovados ({perfil.ano})
      </h3>
      <p className="text-[11px] text-[#6b7280] mb-3">
        {perfil.totalAprovados} aprovados em{' '}
        <span className="font-medium text-[#1d1d1f]">{perfil.modalidade}</span>.
      </p>

      {/* Grid detalhado: minima, P25, media, P75, maxima */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <div className="bg-[#f7f6f3] rounded-lg px-2 py-2 text-center">
          <span className="text-[8px] text-[#9ca3af] uppercase tracking-wider">Minima</span>
          <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums leading-tight mt-0.5">
            {formatNota(perfil.notaMinima)}
          </p>
        </div>
        <div className="bg-[#f7f6f3] rounded-lg px-2 py-2 text-center">
          <span className="text-[8px] text-[#9ca3af] uppercase tracking-wider">P25</span>
          <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums leading-tight mt-0.5">
            {formatNota(perfil.notaP25)}
          </p>
        </div>
        <div className="bg-[#eff6ff] rounded-lg px-2 py-2 text-center">
          <span className="text-[8px] text-[#3b82f6] uppercase tracking-wider font-medium">Media</span>
          <p className="text-[14px] font-bold text-[#3b82f6] tabular-nums leading-tight mt-0.5">
            {formatNota(perfil.notaMedia)}
          </p>
        </div>
        <div className="bg-[#f7f6f3] rounded-lg px-2 py-2 text-center">
          <span className="text-[8px] text-[#9ca3af] uppercase tracking-wider">P75</span>
          <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums leading-tight mt-0.5">
            {formatNota(perfil.notaP75)}
          </p>
        </div>
        <div className="bg-[#f7f6f3] rounded-lg px-2 py-2 text-center">
          <span className="text-[8px] text-[#9ca3af] uppercase tracking-wider">Maxima</span>
          <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums leading-tight mt-0.5">
            {formatNota(perfil.notaMaxima)}
          </p>
        </div>
      </div>

      {/* Comparacao textual com o aluno */}
      <div className="space-y-2">
        <p className="text-[11px] text-[#374151] leading-relaxed">
          <span className="font-bold text-[#1d1d1f]">Comparacao com seu desempenho: </span>
          {notaAtual != null ? (
            <>
              Sua nota ponderada atual ({formatNota(notaAtual)}) esta{' '}
              {buildComparacaoText(notaAtual, perfil)}
            </>
          ) : (
            'Nota ponderada nao disponivel para comparacao.'
          )}
        </p>

        {notaAtual != null && perfil.notaP25 > 0 ? (
          <p className="text-[11px] text-[#374151] leading-relaxed">
            <span className="font-bold text-[#1d1d1f]">Para ter 75% de chance de aprovacao</span>,
            voce precisa alcançar pelo menos{' '}
            <span className="font-semibold">{formatNota(perfil.notaP25)}</span>{' '}
            pontos (percentil 25 dos aprovados). Faltam{' '}
            <span className="font-semibold text-[#ef4444]">
              {formatNota(Math.max(0, perfil.notaP25 - notaAtual))}
            </span>{' '}
            pontos.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function buildComparacaoText(notaAtual: number, perfil: PerfilAprovados): string {
  if (notaAtual < perfil.notaMinima) {
    const diff = perfil.notaMinima - notaAtual
    return `abaixo da nota minima dos aprovados (${formatNota(perfil.notaMinima)}). Voce precisa subir ${formatNota(diff)} pontos para alcancar o patamar minimo de aprovacao.`
  }
  if (notaAtual < perfil.notaMedia) {
    const diff = perfil.notaMedia - notaAtual
    return `entre a minima e a media dos aprovados. Voce precisa subir ${formatNota(diff)} pontos para atingir a media.`
  }
  return 'acima da media dos aprovados — posicao competitiva.'
}
