/**
 * Página de Histórico de Simulados (Fase 4 — Federação legacy + cronogramas).
 *
 * Renderiza:
 *  - Cartões com TRI atual por área (LC/CH/CN/MT)
 *  - Evolução TRI ao longo do tempo (gráfico por área)
 *  - Lista cronológica de todos os simulados (legacy + cronogramas)
 *  - Aviso quando scores são estimados (fezDia2=false → floor)
 */

import { useMemo } from "react";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useStudentPerformance } from "@/hooks/useStudentPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, History, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AREA_LABELS, AREA_SHORT, type AreaSigla, type SimuladoPerformance } from "@/types/performance";
import { collectAreaSeriesWithFlags, computeAreaTrend, hasAnyEstimated } from "@/types/performance-utils";
import { cn } from "@/lib/utils";

const AREA_COLORS: Record<AreaSigla, { bg: string; text: string; stroke: string }> = {
  lc: { bg: "bg-rose-500", text: "text-rose-500", stroke: "stroke-rose-500" },
  ch: { bg: "bg-sky-500", text: "text-sky-500", stroke: "stroke-sky-500" },
  cn: { bg: "bg-emerald-500", text: "text-emerald-500", stroke: "stroke-emerald-500" },
  mt: { bg: "bg-violet-500", text: "text-violet-500", stroke: "stroke-violet-500" },
};

const AREA_EMOJI: Record<AreaSigla, string> = {
  lc: "📝",
  ch: "🌍",
  cn: "🔬",
  mt: "📐",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Sparkline sem recharts — renderiza TODOS os pontos (1 por simulado),
 * com dots sólidos para scores válidos e dots tracejados (anel vazio)
 * para scores estimados. Linha de tendência conecta apenas os válidos.
 */
function AreaSparkline({
  performances,
  area,
}: {
  performances: ReadonlyArray<SimuladoPerformance>;
  area: AreaSigla;
}) {
  const points = useMemo(
    () => collectAreaSeriesWithFlags(performances, area),
    [performances, area],
  );

  if (points.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic">
        Sem dados para esta área
      </div>
    );
  }

  const W = 200;
  const H = 48;
  const values = points.map((p) => p.value);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const range = Math.max(1, max - min);

  const coords = points.map((p, i) => ({
    x:
      points.length === 1
        ? W / 2
        : (i / (points.length - 1)) * (W - 8) + 4,
    y: H - ((p.value - min) / range) * (H - 8) - 4,
    estimated: p.estimated,
  }));

  // Linha de tendência conecta apenas os pontos não-estimados (G3 guardrail)
  const validCoords = coords.filter((c) => !c.estimated);
  const pathD =
    validCoords.length >= 2
      ? validCoords
          .map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`))
          .join(" ")
      : null;

  return (
    <svg width={W} height={H} className="overflow-visible">
      {pathD && (
        <path
          d={pathD}
          fill="none"
          strokeWidth="2"
          className={cn(AREA_COLORS[area].stroke)}
        />
      )}
      {coords.map((c, i) =>
        c.estimated ? (
          // Estimated: anel vazio tracejado (visível mas distinto)
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={4}
            fill="white"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            className={cn(AREA_COLORS[area].stroke)}
          >
            <title>Score estimado — dia não realizado ou floor mínimo</title>
          </circle>
        ) : (
          // Válido: dot sólido com borda branca para contraste
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={4}
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
            className={cn(AREA_COLORS[area].bg)}
          >
            <title>Score válido: {c.estimated ? "" : Math.round(points[i].value)}</title>
          </circle>
        ),
      )}
    </svg>
  );
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  if (delta > 5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
        <TrendingUp className="h-3 w-3" />+{delta.toFixed(0)}
      </span>
    );
  }
  if (delta < -5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600">
        <TrendingDown className="h-3 w-3" />
        {delta.toFixed(0)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
      <Minus className="h-3 w-3" />
      {delta >= 0 ? "+" : ""}
      {delta.toFixed(0)}
    </span>
  );
}

export default function HistoricoSimulados() {
  const { data: student, isLoading: loadingStudent } = useStudentProfile();
  const { data, isLoading, error } = useStudentPerformance(student?.id);

  if (loadingStudent || isLoading) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-bold">Não foi possível carregar seu histórico.</p>
          <p className="mt-1 text-xs">{error.message}</p>
        </div>
      </div>
    );
  }

  const performances = data?.performances ?? [];

  if (performances.length === 0) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
        <header>
          <h1 className="text-xl font-black text-foreground">Meu Histórico TRI</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Evolução por área ENEM ao longo dos simulados.
          </p>
        </header>
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">
            Nenhum simulado registrado ainda
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Seus resultados TRI aparecerão aqui quando você participar de simulados.
          </p>
        </div>
      </div>
    );
  }

  const areas: AreaSigla[] = ["lc", "ch", "cn", "mt"];

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <header>
        <h1 className="text-xl font-black text-foreground">Meu Histórico TRI</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {performances.length} simulado{performances.length !== 1 ? "s" : ""} · fontes:{" "}
          {data?.fontes_utilizadas?.join(" + ") ?? "—"}
        </p>
      </header>

      {/* Cards per area with sparkline */}
      <section className="grid grid-cols-2 gap-3">
        {areas.map((area) => {
          const trend = computeAreaTrend(performances, area);
          return (
            <div
              key={area}
              className="rounded-2xl border-2 border-border bg-card p-3 shadow-sm"
              data-testid={`area-card-${area}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    {AREA_SHORT[area]} {AREA_EMOJI[area]}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {AREA_LABELS[area]}
                  </p>
                </div>
                <TrendBadge delta={trend.delta} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-2xl font-black tabular-nums",
                    AREA_COLORS[area].text,
                  )}
                >
                  {trend.current !== null ? trend.current.toFixed(0) : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
              <div className="mt-2">
                <AreaSparkline performances={performances} area={area} />
              </div>
            </div>
          );
        })}
      </section>

      {/* Chronological list */}
      <section>
        <h2 className="mb-2 text-sm font-black text-foreground">Simulados realizados</h2>
        <div className="space-y-2">
          {performances.map((p) => {
            const hasEstimated = hasAnyEstimated(p);
            return (
              <article
                key={`${p.fonte}-${p.simulado_id}`}
                className="rounded-2xl border border-border bg-card p-3 shadow-sm"
                data-testid={`perf-item-${p.simulado_id}`}
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-foreground">
                      {p.simulado_nome}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(p.data)}
                      {" · "}
                      <span
                        className={cn(
                          "inline-block rounded px-1 font-mono text-[9px]",
                          p.fonte === "legacy"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {p.fonte}
                      </span>
                      {p.formato === "tipo2_45" && (
                        <span className="ml-1 inline-block rounded bg-amber-100 px-1 font-mono text-[9px] text-amber-700">
                          45q
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-foreground tabular-nums">
                      {p.tri_total.toFixed(0)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">média</p>
                  </div>
                </header>

                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  {areas.map((a) => (
                    <div
                      key={a}
                      className={cn(
                        "rounded-lg border px-1 py-1",
                        p.tri_estimado[a]
                          ? "border-dashed border-amber-300 bg-amber-50"
                          : "border-border bg-muted/30",
                      )}
                      title={
                        p.tri_estimado[a]
                          ? "Score estimado — dia não realizado ou valor mínimo"
                          : undefined
                      }
                    >
                      <p
                        className={cn(
                          "text-[9px] font-bold uppercase",
                          AREA_COLORS[a].text,
                        )}
                      >
                        {AREA_SHORT[a]}
                      </p>
                      <p className="text-[10px] font-black tabular-nums">
                        {p.tri[a].toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>

                {hasEstimated && (
                  <p className="mt-2 flex items-start gap-1 text-[10px] text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      Algumas áreas têm score estimado (dia não realizado).
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
