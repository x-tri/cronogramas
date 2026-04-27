/**
 * StudentSimuladoDetailDrawer — drawer lateral com o relatorio individual
 * do aluno SELECIONADO no ranking de um simulado especifico.
 *
 * Mostra (sem nova query — dados ja vieram com o ranking):
 *   - Header: nome + turma + data envio + posicao no ranking
 *   - 4 cards TRI por area + media + diff turma
 *   - 4 cards de acertos (X/45 + barra visual)
 *   - 4 listas top 5 topicos mais errados por area
 *
 * Sem PDF download — coordenador exporta tudo via botao "Exportar Excel"
 * que ja existe no header do SimuladoRanking.
 */

import {
  topErrosPorArea,
  type AreaKey,
  type RankedStudent,
} from "../../../services/simulado/ranking-aggregations";

export interface StudentSimuladoDetailDrawerProps {
  readonly open: boolean;
  readonly row: RankedStudent | null;
  readonly mediaTurma: number | null;
  readonly onClose: () => void;
}

const AREA_LABEL: Record<AreaKey, string> = {
  LC: "Linguagens",
  CH: "Humanas",
  CN: "Natureza",
  MT: "Matemática",
};

// Mesmas cores usadas no AreaTriCard do simulado-ranking.tsx
const AREA_COLOR: Record<AreaKey, string> = {
  LC: "#7c3aed",
  CH: "#ea580c",
  CN: "#16a34a",
  MT: "#2563eb",
};

function formatScore(n: number | null): string {
  return n == null ? "—" : Math.round(n).toString();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function posicaoLabel(pos: number): string {
  if (pos === 1) return "🥇 1º";
  if (pos === 2) return "🥈 2º";
  if (pos === 3) return "🥉 3º";
  return `${pos}º`;
}

export function StudentSimuladoDetailDrawer({
  open,
  row,
  mediaTurma,
  onClose,
}: StudentSimuladoDetailDrawerProps) {
  if (!open || row == null) return null;

  const { resposta, posicao, mediaTri, totalAcertos, diffTurma } = row;
  const tri: Record<AreaKey, number | null> = {
    LC: resposta.tri_lc,
    CH: resposta.tri_ch,
    CN: resposta.tri_cn,
    MT: resposta.tri_mt,
  };
  const acertos: Record<AreaKey, number> = {
    LC: resposta.acertos_lc,
    CH: resposta.acertos_ch,
    CN: resposta.acertos_cn,
    MT: resposta.acertos_mt,
  };
  const erros = topErrosPorArea(resposta.erros_por_topico);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Relatório de ${resposta.student_name ?? "aluno"}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[95vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Relatório individual
            </p>
            <h2 className="mt-0.5 text-lg font-black text-[#1d1d1f] truncate">
              {resposta.student_name ?? "(sem nome)"}
            </h2>
            <p className="mt-0.5 text-xs text-[#71717a]">
              {posicaoLabel(posicao)} · Turma {resposta.student_turma ?? "—"} · Enviou em{" "}
              {formatDate(resposta.submitted_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e5e7eb] px-2 py-1 text-xs font-bold text-[#71717a] hover:bg-[#f4f4f5]"
            aria-label="Fechar"
          >
            Fechar
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-5" style={{ maxHeight: "calc(95vh - 70px)" }}>
          {/* Resumo: media + acertos totais + diff turma */}
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                Média TRI
              </p>
              <p className="mt-1 text-base font-black text-[#1d1d1f]">
                {formatScore(mediaTri)}
              </p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                Acertos totais
              </p>
              <p className="mt-1 text-base font-black text-[#1d1d1f]">
                {totalAcertos}
                <span className="text-xs font-normal text-[#94a3b8]">/180</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                ± Turma
              </p>
              <p
                className={`mt-1 text-base font-black ${
                  diffTurma == null
                    ? "text-[#94a3b8]"
                    : diffTurma >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                }`}
              >
                {diffTurma == null
                  ? "—"
                  : `${diffTurma >= 0 ? "+" : ""}${Math.round(diffTurma)}`}
              </p>
              {mediaTurma != null && (
                <p className="text-[9px] text-[#94a3b8] mt-0.5">média turma {Math.round(mediaTurma)}</p>
              )}
            </div>
          </section>

          {/* TRI por area + acertos por area */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Por área
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(AREA_LABEL) as AreaKey[]).map((area) => {
                const triValor = tri[area];
                const ac = acertos[area];
                const pct = (ac / 45) * 100;
                return (
                  <div
                    key={area}
                    className="rounded-xl border border-[#e5e7eb] bg-white p-3 border-l-4"
                    style={{ borderLeftColor: AREA_COLOR[area] }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                      {area} · {AREA_LABEL[area]}
                    </p>
                    <p
                      className="mt-1 text-base font-black tabular-nums"
                      style={{ color: triValor == null ? "#cbd5e1" : AREA_COLOR[area] }}
                      title={triValor == null ? "Não submetido" : undefined}
                    >
                      {formatScore(triValor)}
                    </p>
                    <p className="text-[10px] text-[#94a3b8]">TRI</p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-[#71717a]">Acertos</span>
                        <span className="font-mono font-bold text-[#1d1d1f]">{ac}/45</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: AREA_COLOR[area] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top 5 erros por area */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Top 5 tópicos mais errados (por área)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(AREA_LABEL) as AreaKey[]).map((area) => (
                <div
                  key={area}
                  className="rounded-xl border border-[#e5e7eb] bg-white p-3 border-l-4"
                  style={{ borderLeftColor: AREA_COLOR[area] }}
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                    {area} · {AREA_LABEL[area]}
                  </p>
                  {erros[area].length === 0 ? (
                    <p className="text-[11px] italic text-[#cbd5e1]">
                      Sem erros registrados nesta área
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {erros[area].map((e, idx) => (
                        <li
                          key={`${area}-${idx}`}
                          className="flex items-start justify-between gap-2 text-xs"
                        >
                          <span className="text-[#1d1d1f] leading-snug">{e.topico}</span>
                          <span className="flex-shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                            {e.erros}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
