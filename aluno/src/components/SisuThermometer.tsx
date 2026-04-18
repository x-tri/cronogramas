/**
 * SisuThermometer — termometro gradiente vertical mostrando a nota do aluno
 * em relacao ao curso meta e aos cursos alcancaveis na mesma universidade.
 *
 * Design mobile-first:
 * - Barra vertical h-80 com gradient red→yellow→emerald
 * - Preenchimento animado ate a altura da nota do aluno
 * - Marcadores horizontais em cada curso-corte (label a direita)
 * - Badge "você" na linha da nota, com pulse
 * - Header com meta + faltam X pts
 * - Footer com cursos alcancaveis (check verde)
 */

import type { ThermometerData } from "@/services/sisu-data";
import { cn } from "@/lib/utils";

const TRI_MIN = 200;
const TRI_MAX = 1000;

function toPct(nota: number): number {
  const clamped = Math.max(TRI_MIN, Math.min(TRI_MAX, nota));
  return ((clamped - TRI_MIN) / (TRI_MAX - TRI_MIN)) * 100;
}

export interface SisuThermometerProps {
  readonly data: ThermometerData;
  readonly mediaEnem: number;
  readonly metaCurso: string;
  readonly metaNotaCorte: number;
}

export function SisuThermometer({
  data,
  mediaEnem,
  metaCurso,
  metaNotaCorte,
}: SisuThermometerProps) {
  const alunoPct = toPct(mediaEnem);
  const gap = Math.max(0, Math.round(metaNotaCorte - mediaEnem));
  const uni = data.universidade;

  return (
    <div className="rounded-3xl border-2 bg-card p-4">
      {/* Header */}
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          🎯 Sua meta SISU
        </p>
        <p className="mt-0.5 text-base font-black leading-tight">
          {metaCurso} <span className="text-muted-foreground">·</span>{" "}
          <span className="text-primary">{uni.sigla}</span>
        </p>
        {gap > 0 ? (
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            Faltam{" "}
            <strong className="text-red-600 font-black">{gap} pts</strong>{" "}
            pra entrar
          </p>
        ) : (
          <p className="mt-1 text-xs font-bold text-emerald-600">
            🔥 Você já alcança a nota!
          </p>
        )}
      </div>

      {/* Termometro */}
      <div className="flex gap-3">
        {/* Coluna barra vertical (esquerda) */}
        <div className="relative flex flex-col items-center" style={{ width: 36 }}>
          {/* Bulbo superior */}
          <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-background z-10" />
          {/* Haste */}
          <div className="relative flex-1 w-6 rounded-full bg-muted overflow-hidden" style={{ minHeight: 320 }}>
            {/* Escala gradient no bg */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-100 via-yellow-100 to-red-100" />
            {/* Preenchimento nota atual (bottom->up) */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-emerald-500 via-yellow-400 to-orange-500 transition-all duration-1000"
              style={{ height: `${alunoPct}%` }}
            />
            {/* Marcador meta (linha horizontal com emoji no topo) */}
            <div
              className="absolute inset-x-0 h-0.5 bg-foreground"
              style={{ bottom: `${toPct(metaNotaCorte)}%` }}
              aria-hidden="true"
            />
          </div>
          {/* Bulbo inferior */}
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 border-2 border-background -mt-1 z-10" />
        </div>

        {/* Coluna lista cursos (direita) */}
        <div className="relative flex-1 min-w-0" style={{ minHeight: 340 }}>
          {data.cursosRanked.map((c) => {
            const pct = toPct(c.notaCorte);
            const reached = c.notaCorte <= mediaEnem;
            const isMeta = c.curso === metaCurso;
            return (
              <div
                key={c.curso}
                className="absolute inset-x-0 flex items-center gap-1.5"
                style={{
                  bottom: `${pct}%`,
                  transform: "translateY(50%)",
                }}
              >
                {/* linha tick */}
                <div
                  className={cn(
                    "h-px flex-shrink-0 w-3",
                    reached ? "bg-emerald-500" : "bg-muted-foreground/30",
                  )}
                />
                {/* Curso label */}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span className="text-xs">{c.emoji}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold truncate",
                      isMeta
                        ? "text-red-600 font-black"
                        : reached
                          ? "text-emerald-700"
                          : "text-muted-foreground",
                    )}
                  >
                    {isMeta ? "🎯 " : reached ? "✓ " : ""}
                    {c.curso}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono font-bold flex-shrink-0",
                      isMeta
                        ? "text-red-600"
                        : reached
                          ? "text-emerald-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {c.notaCorte}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Badge "você" na linha da nota atual */}
          <div
            className="absolute inset-x-0 flex items-center gap-1 z-20"
            style={{
              bottom: `${alunoPct}%`,
              transform: "translateY(50%)",
            }}
          >
            <div className="h-0.5 flex-shrink-0 w-3 bg-primary" />
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 shadow-lg animate-pulse">
              <span className="text-[10px]">🔥</span>
              <span className="text-[10px] font-black text-white whitespace-nowrap">
                Você {mediaEnem.toFixed(0)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Footer — cursos alcancaveis */}
      {data.alcancaveis.length > 0 && (
        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            ✓ Hoje você já alcança {data.alcancaveis.length} curso
            {data.alcancaveis.length === 1 ? "" : "s"} na {uni.sigla}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {data.alcancaveis.slice(0, 4).map((c) => (
              <span
                key={c.curso}
                className="inline-flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm"
              >
                <span>{c.emoji}</span>
                <span>{c.curso}</span>
              </span>
            ))}
            {data.alcancaveis.length > 4 && (
              <span className="text-[10px] font-bold text-emerald-600">
                +{data.alcancaveis.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {data.proxima && (
        <div className="mt-2 rounded-2xl bg-blue-50 border border-blue-200 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
            Próxima conquista
          </p>
          <p className="mt-0.5 text-xs font-bold text-blue-900">
            {data.proxima.emoji} {data.proxima.curso} —{" "}
            <strong className="font-black">
              +{Math.round(data.proxima.notaCorte - mediaEnem)} pts
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
