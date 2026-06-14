/**
 * SisuThermometer — visualizacao mobile-first de progressao SISU.
 *
 * Redesign: em vez de termometro vertical com posicionamento absoluto
 * (que causava overlap de cursos com notas proximas), usa lista clean
 * ordenada por corte desc, com "linha voce" inserida na posicao correta.
 * Cada linha: emoji + nome + corte + barra horizontal + status.
 */

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SISU_CORTES_ANO } from "@/services/sisu-data";
import type { ThermometerData, SisuCurso } from "@/services/sisu-data";

export interface SisuThermometerProps {
  readonly data: ThermometerData;
  readonly mediaEnem: number;
  readonly metaCurso: string;
  readonly metaNotaCorte: number;
  /** Edicao do SISU de onde vieram os cortes exibidos. */
  readonly anoCortes?: number;
  /** Se fornecido, mostra um botao de editar a meta no header. */
  readonly onEdit?: () => void;
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
              {curso.notaCorte} pts
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
  anoCortes = SISU_CORTES_ANO,
  onEdit,
}: SisuThermometerProps) {
  const gap = Math.max(0, Math.round(metaNotaCorte - mediaEnem));
  const uni = data.universidade;
  // max corte = meta (topo da escala visual)
  const maxCorte = Math.max(
    metaNotaCorte,
    ...data.cursosRanked.map((c) => c.notaCorte),
  );

  // Divide cursos em acima/abaixo da nota atual. Com a base completa de
  // cortes a lista pode ter dezenas de cursos: mostra so os 5 mais proximos
  // de cada lado (a meta do aluno sempre aparece).
  const acimaAll = data.cursosRanked.filter((c) => c.notaCorte > mediaEnem);
  const abaixoAll = data.cursosRanked.filter((c) => c.notaCorte <= mediaEnem);
  const VIZINHOS = 5;
  const acima = acimaAll
    .slice(-VIZINHOS)
    .concat(
      acimaAll
        .slice(0, -VIZINHOS)
        .filter((c) => c.curso === metaCurso),
    )
    .sort((a, b) => b.notaCorte - a.notaCorte);
  const abaixo = abaixoAll
    .slice(0, VIZINHOS)
    .concat(
      abaixoAll.slice(VIZINHOS).filter((c) => c.curso === metaCurso),
    )
    .sort((a, b) => b.notaCorte - a.notaCorte);
  const acimaOcultos = acimaAll.length - acima.length;
  const abaixoOcultos = abaixoAll.length - abaixo.length;

  return (
    <div className="rounded-3xl border-2 bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            🎯 Sua meta SISU
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Editar meta"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
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
      {acimaOcultos > 0 && (
        <p className="mb-1.5 text-center text-[10px] font-semibold text-muted-foreground">
          + {acimaOcultos} curso{acimaOcultos === 1 ? "" : "s"} mais
          concorrido{acimaOcultos === 1 ? "" : "s"} acima
        </p>
      )}
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
      {abaixoOcultos > 0 && (
        <p className="mt-1.5 text-center text-[10px] font-semibold text-muted-foreground">
          + {abaixoOcultos} outro{abaixoOcultos === 1 ? "" : "s"} curso
          {abaixoOcultos === 1 ? "" : "s"} que você já alcança
        </p>
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

      {/* Legenda + aviso de defasagem dos cortes */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted-foreground">
        <span>🎯 sua meta</span>
        <span>✓ você já alcança</span>
        <span>+N pts faltando</span>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
        ⚠️ Cortes de referência SISU {anoCortes} (ampla concorrência) —
        os valores mudam a cada edição.
      </p>
    </div>
  );
}
