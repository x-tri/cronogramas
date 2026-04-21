/**
 * StudentTriHistoryDrawer — admin/coordinator view of a student's full TRI history
 * across legacy (projetos) and cronogramas (simulado_respostas), via the
 * get-student-performance Edge Function (Phase 3 + 4).
 *
 * Triggered from admin ranking tables: click on a student row → this drawer
 * opens with the student's complete historical performance.
 *
 * Guardrails respected:
 *   - tri_estimado flag shown on each area when score is floor-estimated
 *   - legacy vs cronogramas source clearly tagged
 *   - tipo2_45 (45-questão) simulados tagged separately
 */

import { useEffect, useState, type ReactElement } from "react";

import { supabase } from "../../lib/supabase";

export interface StudentTriHistoryDrawerProps {
  readonly open: boolean;
  readonly studentId: string | null;
  readonly studentName?: string | null;
  readonly onClose: () => void;
}

// Types (inlined — avoids cross-deps with aluno package)
type Fonte = "legacy" | "cronogramas";
type Formato = "enem_180" | "tipo2_45";

interface SimuladoPerformance {
  readonly fonte: Fonte;
  readonly simulado_id: string;
  readonly simulado_nome: string;
  readonly data: string;
  readonly formato: Formato;
  readonly fez_dia1: boolean;
  readonly fez_dia2: boolean;
  readonly tri: { lc: number; ch: number; cn: number; mt: number };
  readonly tri_estimado: { lc: boolean; ch: boolean; cn: boolean; mt: boolean };
  readonly acertos: { lc: number; ch: number; cn: number; mt: number };
  readonly tri_total: number;
}

interface Response {
  readonly student_id: string;
  readonly matricula: string;
  readonly school_id: string;
  readonly performances: SimuladoPerformance[];
  readonly fontes_utilizadas: Fonte[];
  readonly legacy_status: "ok" | "fallback" | "disabled";
  readonly cronogramas_status: "ok" | "fallback";
  readonly fetched_at: string;
}

const AREAS = ["lc", "ch", "cn", "mt"] as const;
type Area = (typeof AREAS)[number];

const AREA_COLOR: Record<Area, string> = {
  lc: "#f43f5e",
  ch: "#0ea5e9",
  cn: "#10b981",
  mt: "#8b5cf6",
};

const AREA_LABEL: Record<Area, string> = {
  lc: "LC",
  ch: "CH",
  cn: "CN",
  mt: "MT",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AreaMiniTrend({
  performances,
  area,
}: {
  performances: readonly SimuladoPerformance[];
  area: Area;
}) {
  const valid = [...performances]
    .filter((p) => !p.tri_estimado[area] && p.tri[area] > 0)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .map((p) => p.tri[area]);

  if (valid.length < 2) {
    return <div className="text-[10px] text-[#94a3b8] italic">sem histórico</div>;
  }

  const W = 140;
  const H = 32;
  const min = Math.min(...valid) - 15;
  const max = Math.max(...valid) + 15;
  const range = Math.max(1, max - min);

  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * (W - 8) + 4;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return { x, y };
  });

  return (
    <svg width={W} height={H}>
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={AREA_COLOR[area]}
        strokeWidth="1.8"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={AREA_COLOR[area]} />
      ))}
    </svg>
  );
}

export function StudentTriHistoryDrawer({
  open,
  studentId,
  studentName,
  onClose,
}: StudentTriHistoryDrawerProps): ReactElement | null {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);

  useEffect(() => {
    if (!open || !studentId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { data: resp, error: err } = await supabase.functions.invoke(
          "get-student-performance",
          { body: { student_id: studentId } },
        );
        if (cancelled) return;
        if (err) {
          setError(err.message ?? "Falha ao carregar histórico");
          setData(null);
        } else {
          setData(resp as Response);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  if (!open) return null;

  const performances = data?.performances ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="tri-history-drawer"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#1d1d1f]">
              Histórico TRI
              {studentName && (
                <span className="ml-2 font-medium text-[#71717a]">· {studentName}</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-[#71717a]">
              {data
                ? `Matrícula ${data.matricula} · ${performances.length} simulado${performances.length !== 1 ? "s" : ""} · fontes: ${data.fontes_utilizadas.join(" + ") || "—"}`
                : "Carregando..."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e5e7eb] px-2 py-1 text-xs font-bold text-[#71717a] hover:bg-[#f4f4f5]"
            data-testid="tri-drawer-close"
          >
            Fechar
          </button>
        </header>

        <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(85vh - 70px)" }}>
          {loading && (
            <div className="space-y-3">
              <div className="h-8 w-full animate-pulse rounded bg-[#f4f4f5]" />
              <div className="h-32 w-full animate-pulse rounded bg-[#f4f4f5]" />
              <div className="h-20 w-full animate-pulse rounded bg-[#f4f4f5]" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-bold">Erro ao carregar histórico</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          )}

          {!loading && !error && performances.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-[#e5e7eb] p-8 text-center">
              <p className="text-sm font-bold text-[#1d1d1f]">
                Nenhum simulado registrado
              </p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Este aluno ainda não aparece em nenhum simulado (legacy ou cronogramas).
              </p>
            </div>
          )}

          {!loading && !error && performances.length > 0 && (
            <>
              {/* Per-area summary grid */}
              <section className="mb-5 grid grid-cols-2 gap-2">
                {AREAS.map((area) => {
                  const valid = performances.filter(
                    (p) => !p.tri_estimado[area] && p.tri[area] > 0,
                  );
                  const current = valid[0]?.tri[area] ?? null;
                  const previous = valid[1]?.tri[area] ?? null;
                  const delta =
                    current !== null && previous !== null ? current - previous : null;

                  return (
                    <div
                      key={area}
                      className="rounded-xl border border-[#e5e7eb] bg-white p-3"
                      data-testid={`admin-area-${area}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-black uppercase"
                          style={{ color: AREA_COLOR[area] }}
                        >
                          {AREA_LABEL[area]}
                        </span>
                        {delta !== null && (
                          <span
                            className={
                              delta > 5
                                ? "text-[10px] font-bold text-emerald-600"
                                : delta < -5
                                  ? "text-[10px] font-bold text-red-600"
                                  : "text-[10px] font-medium text-amber-600"
                            }
                          >
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span
                          className="text-xl font-black tabular-nums"
                          style={{ color: AREA_COLOR[area] }}
                        >
                          {current !== null ? current.toFixed(0) : "—"}
                        </span>
                        <span className="text-[10px] text-[#94a3b8]">pts</span>
                      </div>
                      <div className="mt-1">
                        <AreaMiniTrend performances={performances} area={area} />
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Chronological list */}
              <section>
                <h3 className="mb-2 text-xs font-black uppercase text-[#71717a]">
                  Simulados ({performances.length})
                </h3>
                <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#f9fafb]">
                      <tr>
                        <th className="px-2 py-2 text-left font-bold text-[#71717a]">
                          Data / Simulado
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          Fonte
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          LC
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          CH
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          CN
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          MT
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-[#71717a]">
                          Média
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f5]">
                      {performances.map((p) => (
                        <tr key={`${p.fonte}-${p.simulado_id}`}>
                          <td className="px-2 py-2">
                            <div className="font-medium text-[#1d1d1f] line-clamp-1">
                              {p.simulado_nome}
                            </div>
                            <div className="text-[10px] text-[#94a3b8]">
                              {formatDate(p.data)}
                              {p.formato === "tipo2_45" && (
                                <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-700">
                                  45q
                                </span>
                              )}
                              {!p.fez_dia1 && (
                                <span className="ml-1 rounded bg-red-50 px-1 text-[9px] text-red-700">
                                  sem D1
                                </span>
                              )}
                              {!p.fez_dia2 && (
                                <span className="ml-1 rounded bg-red-50 px-1 text-[9px] text-red-700">
                                  sem D2
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={
                                p.fonte === "legacy"
                                  ? "rounded bg-slate-100 px-1 text-[9px] text-slate-600"
                                  : "rounded bg-emerald-100 px-1 text-[9px] text-emerald-700"
                              }
                            >
                              {p.fonte}
                            </span>
                          </td>
                          {AREAS.map((a) => (
                            <td
                              key={a}
                              className={
                                p.tri_estimado[a]
                                  ? "px-2 py-2 text-center font-mono italic text-amber-600"
                                  : "px-2 py-2 text-center font-mono"
                              }
                              title={
                                p.tri_estimado[a]
                                  ? "Estimado (floor score)"
                                  : undefined
                              }
                            >
                              {p.tri[a].toFixed(0)}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-black tabular-nums">
                            {p.tri_total.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-[#94a3b8]">
                  Células em <span className="italic text-amber-600">âmbar</span> indicam
                  scores estimados (dia não realizado ou valor mínimo).
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
