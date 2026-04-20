/**
 * SimuladoRanking — painel full-screen com ranking pedagogico completo
 * do simulado (substitui o ResponsesDrawer mais enxuto).
 *
 * Secoes:
 *   1. Header com titulo + stats do grupo (N alunos, media, desvio, melhor, pior)
 *   2. Filtro por turma + action "Fechar"
 *   3. Tabela ranking com medalhas 🥇🥈🥉 + posicao + aluno + TRI + media + diff
 *   4. Top 5 topicos errados pela turma (agregado)
 *   5. Media de acertos por area (bar chart horizontal)
 *   6. Histograma de distribuicao de notas (bins de 50)
 *   7. Alunos que nao responderam (LEFT JOIN students sem simulado_respostas)
 *
 * Pure aggregations em src/services/simulado/ranking-aggregations.ts
 * (testadas separadamente, 19 tests).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../../../lib/supabase";
import {
  exportRankingExcel,
} from "../../../services/simulado/export-excel";
import {
  filtrarPorTurma,
  histogramaNotas,
  mediaAcertosPorArea,
  rankRespostas,
  statsGrupo,
  topicoMaisErradoPorArea,
  topicosErradosTurma,
  turmasPresentes,
  type RankingResposta,
} from "../../../services/simulado/ranking-aggregations";

export interface SimuladoRankingProps {
  readonly open: boolean;
  readonly simuladoId: string | null;
  readonly simuladoTitle: string;
  readonly schoolId: string | null;
  readonly turmasAlvo: ReadonlyArray<string>;
  readonly onClose: () => void;
  readonly onViewAluno?: (respostaId: string) => void;
}

interface StudentRow {
  readonly id: string;
  readonly name: string | null;
  readonly turma: string | null;
  readonly matricula: string | null;
}

const AREA_LABELS = {
  LC: "Linguagens",
  CH: "Humanas",
  CN: "Natureza",
  MT: "Matemática",
} as const;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
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

function formatScore(n: number | null): string {
  return n == null ? "—" : Math.round(n).toString();
}

function posicaoBadge(pos: number): string {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}º`;
}

export function SimuladoRanking({
  open,
  simuladoId,
  simuladoTitle,
  schoolId,
  turmasAlvo,
  onClose,
  onViewAluno,
}: SimuladoRankingProps) {
  const [respostas, setRespostas] = useState<ReadonlyArray<RankingResposta>>([]);
  const [naoResponderam, setNaoResponderam] = useState<ReadonlyArray<StudentRow>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [turmaFiltro, setTurmaFiltro] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC fecha o dialog + move foco pro container quando abrir (focus trap leve).
  useEffect(() => {
    if (!open) return;
    containerRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !simuladoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      // Respostas com dados do aluno (join students pra nome/turma)
      const respostasRes = await supabase
        .from("simulado_respostas")
        .select(
          "id, student_id, tri_lc, tri_ch, tri_cn, tri_mt, " +
            "acertos_lc, acertos_ch, acertos_cn, acertos_mt, " +
            "erros_por_topico, submitted_at, " +
            "students:student_id (id, name, turma, matricula)",
        )
        .eq("simulado_id", simuladoId)
        .order("submitted_at", { ascending: false });

      if (cancelled) return;

      if (respostasRes.error) {
        setError(respostasRes.error.message);
        setLoading(false);
        return;
      }

      // Normaliza: move name/turma de nested pra flat
      const normalizadas: RankingResposta[] = (respostasRes.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.students?.name ?? null,
          student_turma: r.students?.turma ?? null,
          tri_lc: r.tri_lc,
          tri_ch: r.tri_ch,
          tri_cn: r.tri_cn,
          tri_mt: r.tri_mt,
          acertos_lc: r.acertos_lc,
          acertos_ch: r.acertos_ch,
          acertos_cn: r.acertos_cn,
          acertos_mt: r.acertos_mt,
          erros_por_topico: r.erros_por_topico ?? {},
          submitted_at: r.submitted_at,
        }),
      );

      setRespostas(normalizadas);

      // Alunos que nao responderam: students da escola (+ turma filter se aplicavel)
      if (schoolId) {
        let studentsQuery = supabase
          .from("students")
          .select("id, name, turma, matricula")
          .eq("school_id", schoolId);

        if (turmasAlvo.length > 0) {
          studentsQuery = studentsQuery.in("turma", [...turmasAlvo]);
        }

        const studentsRes = await studentsQuery;
        if (cancelled) return;

        if (studentsRes.error) {
          // Nao bloqueia o painel inteiro — ranking/stats/histograma ja estao
          // prontos. Apenas avisa dev via console e limpa a lista.
          // eslint-disable-next-line no-console
          console.warn(
            "Falha ao carregar alunos nao-respondentes:",
            studentsRes.error.message,
          );
          setNaoResponderam([]);
        } else {
          const respondentes = new Set(normalizadas.map((r) => r.student_id));
          const allStudents = (studentsRes.data ?? []) as StudentRow[];
          const naoRespondem = allStudents.filter((s) => !respondentes.has(s.id));
          setNaoResponderam(naoRespondem);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, simuladoId, schoolId, turmasAlvo]);

  // Derivacoes (pure)
  const filtradas = useMemo(
    () => filtrarPorTurma(respostas, turmaFiltro),
    [respostas, turmaFiltro],
  );
  const ranked = useMemo(() => rankRespostas(filtradas), [filtradas]);
  const stats = useMemo(() => statsGrupo(filtradas), [filtradas]);
  const topicoPorArea = useMemo(
    () => topicoMaisErradoPorArea(filtradas),
    [filtradas],
  );
  const mediaArea = useMemo(() => mediaAcertosPorArea(filtradas), [filtradas]);
  const histograma = useMemo(() => histogramaNotas(filtradas, 50), [filtradas]);
  const turmas = useMemo(() => turmasPresentes(respostas), [respostas]);

  const naoResponderamFiltered = useMemo(() => {
    if (!turmaFiltro) return naoResponderam;
    return naoResponderam.filter((s) => s.turma === turmaFiltro);
  }, [naoResponderam, turmaFiltro]);

  function handleExport(): void {
    exportRankingExcel({
      simuladoTitle,
      turmaLabel: turmaFiltro || "Todas",
      ranked,
      stats,
      topTopicos: topicosErradosTurma(filtradas),   // todos os tópicos (sem limit) no Excel
      topicoPorArea,
      mediaArea,
      naoResponderam: naoResponderamFiltered,
    });
  }

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Ranking de ${simuladoTitle}`}
      className="fixed inset-0 z-40 flex flex-col bg-[#f5f5f7] outline-none"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] bg-white px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar para lista de simulados"
            className="rounded-full p-2 hover:bg-[#f4f4f5]"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Ranking pedagógico
            </p>
            <h1 className="truncate text-base font-bold text-[#1d1d1f]">
              {simuladoTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {turmas.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="turma-filter"
                className="text-xs font-semibold text-[#71717a]"
              >
                Turma:
              </label>
              <select
                id="turma-filter"
                value={turmaFiltro}
                onChange={(e) => setTurmaFiltro(e.target.value)}
                className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm"
              >
                <option value="">Todas ({respostas.length})</option>
                {turmas.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={loading || ranked.length === 0}
            aria-label="Exportar ranking em Excel"
            className="flex items-center gap-1.5 rounded-lg border border-[#16a34a] bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#16a34a] hover:bg-[#dcfce7] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 15V3m0 12-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar Excel
          </button>
        </div>
      </header>

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <p className="text-sm text-[#71717a]">Carregando ranking...</p>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b]"
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Stats grupo */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Alunos" value={String(stats.count)} emoji="👥" />
              <StatCard
                label="Média da turma"
                value={formatScore(stats.media)}
                emoji="📊"
                accent
              />
              <StatCard
                label="Desvio"
                value={formatScore(stats.desvio)}
                emoji="📈"
              />
              <StatCard
                label="Maior TRI"
                value={formatScore(stats.melhor)}
                emoji="🥇"
                positive
              />
              <StatCard
                label="Menor TRI"
                value={formatScore(stats.pior)}
                emoji="📉"
                negative
              />
            </section>

            {/* Tabela Ranking */}
            <section className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f4f4f5]">
                <h2 className="text-sm font-bold text-[#1d1d1f]">
                  🏆 Ranking ({ranked.length} aluno{ranked.length === 1 ? "" : "s"})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Aluno</th>
                      <th className="px-2 py-2 text-center font-semibold">Turma</th>
                      <th className="px-2 py-2 text-center font-semibold">LC</th>
                      <th className="px-2 py-2 text-center font-semibold">CH</th>
                      <th className="px-2 py-2 text-center font-semibold">CN</th>
                      <th className="px-2 py-2 text-center font-semibold">MT</th>
                      <th className="px-2 py-2 text-center font-semibold">Média</th>
                      <th className="px-2 py-2 text-center font-semibold">± turma</th>
                      <th className="px-2 py-2 text-center font-semibold">Acertos</th>
                      <th className="px-3 py-2 text-left font-semibold">Enviou</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5]">
                    {ranked.length === 0 && (
                      <tr>
                        <td
                          colSpan={11}
                          className="px-3 py-8 text-center text-[#94a3b8] italic"
                        >
                          Nenhum aluno respondeu ainda.
                        </td>
                      </tr>
                    )}
                    {ranked.map((row) => (
                      <tr
                        key={row.resposta.id}
                        className="hover:bg-[#fafbff] cursor-pointer"
                        onClick={() => onViewAluno?.(row.resposta.id)}
                      >
                        <td className="px-3 py-2 text-center text-sm font-black">
                          {posicaoBadge(row.posicao)}
                        </td>
                        <td className="px-3 py-2 font-medium text-[#1d1d1f]">
                          {row.resposta.student_name ?? "(sem nome)"}
                        </td>
                        <td className="px-2 py-2 text-center text-[#71717a]">
                          {row.resposta.student_turma ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-center font-mono">
                          {formatScore(row.resposta.tri_lc)}
                        </td>
                        <td className="px-2 py-2 text-center font-mono">
                          {formatScore(row.resposta.tri_ch)}
                        </td>
                        <td className="px-2 py-2 text-center font-mono">
                          {formatScore(row.resposta.tri_cn)}
                        </td>
                        <td className="px-2 py-2 text-center font-mono">
                          {formatScore(row.resposta.tri_mt)}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-[#1d1d1f]">
                          {formatScore(row.mediaTri)}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold">
                          {row.diffTurma == null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                row.diffTurma >= 0 ? "text-emerald-600" : "text-red-600"
                              }
                            >
                              {row.diffTurma >= 0 ? "+" : ""}
                              {Math.round(row.diffTurma)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-[#71717a]">
                          {row.totalAcertos}/180
                        </td>
                        <td className="px-3 py-2 text-[#71717a] whitespace-nowrap">
                          {formatDate(row.resposta.submitted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Tópico mais errado por área — 1 por área (pedagogicamente mais útil
                  que top 5 geral quando o N de respondentes é baixo) */}
              <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <h2 className="mb-3 text-sm font-bold text-[#1d1d1f]">
                  🎯 Tópico mais errado por área
                </h2>
                {(["LC", "CH", "CN", "MT"] as const).every((a) => topicoPorArea[a] == null) ? (
                  <p className="text-xs italic text-[#94a3b8]">
                    Sem dados de tópicos ainda.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(["LC", "CH", "CN", "MT"] as const).map((area) => {
                      const t = topicoPorArea[area];
                      return (
                        <li key={area} className="border-l-2 border-[#e5e7eb] pl-3">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                              {area}
                            </span>
                            <span className="text-[10px] text-[#71717a]">
                              {AREA_LABELS[area]}
                            </span>
                          </div>
                          {t == null ? (
                            <p className="text-xs italic text-[#c7c7c7]">
                              Nenhum erro registrado nessa área
                            </p>
                          ) : (
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-semibold text-[#1d1d1f]">
                                {t.topico}
                              </span>
                              <span className="flex-shrink-0 text-[10px] text-[#71717a]">
                                <strong className="text-red-600">{t.totalErros}</strong>{" "}
                                erros · {t.alunosAfetados} aluno
                                {t.alunosAfetados === 1 ? "" : "s"}
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Áreas fracas da turma */}
              <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <h2 className="mb-3 text-sm font-bold text-[#1d1d1f]">
                  📊 Média de acertos por área
                </h2>
                <ul className="space-y-2">
                  {(["LC", "CH", "CN", "MT"] as const).map((area) => {
                    const media = mediaArea[area];
                    const pct = (media / 45) * 100;
                    return (
                      <li key={area}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#1d1d1f]">
                            {area} · {AREA_LABELS[area]}
                          </span>
                          <span className="font-mono text-[#71717a]">
                            <strong className="text-[#1d1d1f]">{media.toFixed(1)}</strong>/45
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-[#f4f4f5] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            {/* Histograma de distribuição */}
            <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
              <h2 className="mb-3 text-sm font-bold text-[#1d1d1f]">
                📈 Distribuição de notas (média TRI)
              </h2>
              {histograma.every((b) => b.count === 0) ? (
                <p className="text-xs italic text-[#94a3b8]">
                  Nenhum aluno com média TRI calculada.
                </p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {histograma.map((b) => {
                    const maxCount = Math.max(...histograma.map((x) => x.count), 1);
                    const heightPct = (b.count / maxCount) * 100;
                    return (
                      <div
                        key={b.min}
                        className="flex-1 flex flex-col items-center justify-end"
                        title={`${b.min}–${b.max}: ${b.count} aluno${b.count === 1 ? "" : "s"}`}
                      >
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-[#2563eb] to-[#60a5fa] min-h-[2px]"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[8px] font-bold text-[#94a3b8] mt-1">
                          {b.min}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Quem não respondeu */}
            {naoResponderamFiltered.length > 0 && (
              <section className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4">
                <h2 className="mb-3 text-sm font-bold text-[#9a3412]">
                  ⚠️ Alunos que ainda não responderam ({naoResponderamFiltered.length})
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {naoResponderamFiltered.slice(0, 30).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-[#1d1d1f] truncate flex-1 min-w-0">
                        {s.name ?? "(sem nome)"}
                      </span>
                      <span className="text-[10px] text-[#9a3412] flex-shrink-0">
                        {s.turma ?? "—"} · {s.matricula ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                {naoResponderamFiltered.length > 30 && (
                  <p className="mt-2 text-[10px] text-[#9a3412]">
                    +{naoResponderamFiltered.length - 30} não mostrados
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly emoji: string;
  readonly accent?: boolean;
  readonly positive?: boolean;
  readonly negative?: boolean;
}

function StatCard({ label, value, emoji, accent, positive, negative }: StatCardProps) {
  const valueClass = positive
    ? "text-emerald-600"
    : negative
      ? "text-red-600"
      : accent
        ? "text-[#2563eb]"
        : "text-[#1d1d1f]";
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-3">
      <div className="flex items-center gap-1">
        <span className="text-sm">{emoji}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">
          {label}
        </p>
      </div>
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}
