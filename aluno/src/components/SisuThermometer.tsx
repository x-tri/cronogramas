/**
 * SisuThermometer — visualizacao mobile-first de progressao SISU.
 *
 * Redesign: em vez de termometro vertical com posicionamento absoluto
 * (que causava overlap de cursos com notas proximas), usa lista clean
 * ordenada por corte desc, com "linha voce" inserida na posicao correta.
 * Cada linha: emoji + nome + corte + barra horizontal + status.
 */

import { cn } from "@/lib/utils";
import type { ThermometerData, SisuCurso } from "@/services/sisu-data";

export interface SisuThermometerProps {
  readonly data: ThermometerData;
  readonly mediaEnem: number;
  readonly metaCurso: string;
  readonly metaNotaCorte: number;
}

function CursoRow({
  curso,
  mediaEnem,
  maxCorte,
  metaCurso,
}: {
  readonly curso: SisuCurso;
  readonly mediaEnem: number;
  readonly maxCorte: number;
  readonly metaCurso: string;
}) {
  const reached = curso.notaCorte <= mediaEnem;
  const isMeta = curso.curso === metaCurso;
  const pct = (curso.notaCorte / maxCorte) * 100;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-2.5 py-2",
        isMeta
          ? "bg-red-50 border border-red-200"
          : reached
            ? "bg-emerald-50"
            : "bg-muted/30",
      )}
    >
      <span className="text-lg flex-shrink-0 leading-none">{curso.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-xs font-black truncate flex items-center gap-1",
              isMeta
                ? "text-red-600"
                : reached
                  ? "text-emerald-700"
                  : "text-foreground/70",
            )}
          >
            {isMeta && <span>🎯</span>}
            {reached && !isMeta && <span className="text-emerald-600">✓</span>}
            <span className="truncate">{curso.curso}</span>
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span
              className={cn(
                "text-[10px] font-mono font-black",
                isMeta
                  ? "text-red-600"
                  : reached
                    ? "text-emerald-600"
                    : "text-muted-foreground",
              )}
            >
              {curso.notaCorte}
            </span>
            {!reached && !isMeta && (
              <span className="text-[9px] font-bold text-muted-foreground">
                +{Math.round(curso.notaCorte - mediaEnem)}
              </span>
            )}
          </div>
        </div>
        {/* barra proporcional ao corte relativo */}
        <div className="mt-1 h-1 rounded-full bg-background/50 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              isMeta
                ? "bg-red-400"
                : reached
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/30",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function SisuThermometer({
  data,
  mediaEnem,
  metaCurso,
  metaNotaCorte,
}: SisuThermometerProps) {
  const gap = Math.max(0, Math.round(metaNotaCorte - mediaEnem));
  const uni = data.universidade;
  // max corte = meta (topo da escala visual)
  const maxCorte = Math.max(
    metaNotaCorte,
    ...data.cursosRanked.map((c) => c.notaCorte),
  );

  // Divide cursos em acima/abaixo da nota atual
  const acima = data.cursosRanked.filter((c) => c.notaCorte > mediaEnem);
  const abaixo = data.cursosRanked.filter((c) => c.notaCorte <= mediaEnem);

  return (
    <div className="rounded-3xl border-2 bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            🎯 Sua meta SISU
          </p>
          <p className="mt-0.5 text-sm font-black leading-tight">
            {metaCurso} <span className="text-muted-foreground">·</span>{" "}
            <span className="text-primary">{uni.sigla}/{uni.uf}</span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {gap > 0 ? (
            <>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Faltam
              </p>
              <p className="text-lg font-black leading-none text-red-600">
                {gap}
              </p>
              <p className="text-[9px] font-bold text-muted-foreground">
                pts pra meta
              </p>
            </>
          ) : (
            <p className="text-xs font-black text-emerald-600 mt-1">
              🔥 Meta alcançada!
            </p>
          )}
        </div>
      </div>

      {/* Lista cursos acima da nota */}
      {acima.length > 0 && (
        <div className="space-y-1.5">
          {acima.map((c) => (
            <CursoRow
              key={c.curso}
              curso={c}
              mediaEnem={mediaEnem}
              maxCorte={maxCorte}
              metaCurso={metaCurso}
            />
          ))}
        </div>
      )}

      {/* Linha "Você" */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-dashed border-primary" />
        </div>
        <div className="relative flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 shadow-lg">
            <span className="text-xs">🔥</span>
            <span className="text-xs font-black text-white">
              Você {mediaEnem.toFixed(0)}
            </span>
          </span>
        </div>
      </div>

      {/* Lista cursos abaixo (alcancados) */}
      {abaixo.length > 0 && (
        <div className="space-y-1.5">
          {abaixo.map((c) => (
            <CursoRow
              key={c.curso}
              curso={c}
              mediaEnem={mediaEnem}
              maxCorte={maxCorte}
              metaCurso={metaCurso}
            />
          ))}
        </div>
      )}

      {/* Footer — resumo */}
      <div className="mt-4 grid gap-2">
        {data.alcancaveis.length > 0 && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-emerald-700">
              ✓ Hoje você alcança {data.alcancaveis.length} curso
              {data.alcancaveis.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {data.proxima && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-blue-700">
              Próxima conquista
            </p>
            <p className="mt-0.5 text-xs font-bold text-blue-900">
              {data.proxima.emoji} {data.proxima.curso} — faltam{" "}
              <strong className="font-black">
                +{Math.round(data.proxima.notaCorte - mediaEnem)} pts
              </strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
