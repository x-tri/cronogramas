/**
 * Pagina de resultado do simulado do aluno (Fase 4).
 *
 * Consome RPC `get_student_simulado_resultado` e renderiza:
 * - 4 gauges TRI por area (escala ENEM 200-1000)
 * - Totais gerais (acertos/erros/branco) + media geral
 * - Top topicos errados (bar chart simples)
 * - Link para revisar questao por questao (itens com gabarito pos-submit)
 */

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useSimuladoResultado } from "@/hooks/useSimulados";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import {
  AREA_LABELS,
  areaOfNumero,
  type AreaKey,
  type SimuladoResultadoItem,
} from "@/types/simulado";

const AREAS: readonly AreaKey[] = ["LC", "CH", "CN", "MT"];

const TRI_MIN = 200;
const TRI_MAX = 1000;

function triToGaugePercent(score: number | null): number {
  if (score == null) return 0;
  const clamped = Math.max(TRI_MIN, Math.min(TRI_MAX, score));
  return ((clamped - TRI_MIN) / (TRI_MAX - TRI_MIN)) * 100;
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? score.toFixed(0) : "—";
}

function proficiencyLabel(score: number | null): string {
  if (score == null) return "—";
  if (score < 450) return "Abaixo do Básico";
  if (score < 550) return "Básico";
  if (score < 650) return "Adequado";
  return "Avançado";
}

function proficiencyColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score < 450) return "text-red-600";
  if (score < 550) return "text-orange-600";
  if (score < 650) return "text-blue-600";
  return "text-emerald-600";
}

interface SummaryCardProps {
  readonly area: AreaKey;
  readonly score: number | null;
  readonly acertos: number;
}

function AreaCard({ area, score, acertos }: SummaryCardProps) {
  const pct = triToGaugePercent(score);
  const colorClass = proficiencyColor(score);
  return (
    <div className="rounded-2xl border-2 bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">
            {area}
          </p>
          <p className="text-[10px] font-semibold text-muted-foreground">
            {AREA_LABELS[area]}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${colorClass}`}>
            {formatScore(score)}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground">
            {acertos}/45 acertos
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] font-bold ${colorClass}`}>
        {proficiencyLabel(score)}
      </p>
    </div>
  );
}

export default function SimuladoResultado() {
  const { id: simuladoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSimuladoResultado(simuladoId);

  const topTopicos = useMemo(() => {
    if (!data?.resposta?.erros_por_topico) return [];
    return Object.entries(data.resposta.erros_por_topico)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [data]);

  const erroItens = useMemo<readonly SimuladoResultadoItem[]>(() => {
    if (!data?.itens) return [];
    return data.itens.filter((it) => !it.correto && !it.branco);
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.submitted) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-bold">Resultado indisponível.</p>
          <p className="mt-1 text-xs">
            {error?.message ??
              "Você ainda não submeteu este simulado."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/simulados")}
            className="mt-3 text-xs font-bold text-primary underline"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  const resposta = data.resposta!;
  const totais = {
    acertos:
      resposta.acertos_lc +
      resposta.acertos_ch +
      resposta.acertos_cn +
      resposta.acertos_mt,
    erros:
      resposta.erros_lc +
      resposta.erros_ch +
      resposta.erros_cn +
      resposta.erros_mt,
    branco:
      resposta.branco_lc +
      resposta.branco_ch +
      resposta.branco_cn +
      resposta.branco_mt,
  };
  const triScores = [
    resposta.tri_lc,
    resposta.tri_ch,
    resposta.tri_cn,
    resposta.tri_mt,
  ].filter((x): x is number => x != null);
  const mediaGeral =
    triScores.length === 0
      ? null
      : triScores.reduce((a, b) => a + b, 0) / triScores.length;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/simulados")}
          aria-label="Voltar"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-foreground leading-tight truncate">
            {data.simulado?.title ?? "Simulado"}
          </h1>
          <p className="text-[10px] font-semibold text-muted-foreground">
            Resultado oficial (TRI)
          </p>
        </div>
      </div>

      {/* Media geral */}
      {mediaGeral != null && (
        <div className="rounded-2xl border-2 bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Média geral
          </p>
          <p
            className={`text-4xl font-black ${proficiencyColor(mediaGeral)}`}
          >
            {mediaGeral.toFixed(0)}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            {proficiencyLabel(mediaGeral)}
          </p>
        </div>
      )}

      {/* 4 cards TRI por area */}
      <div className="grid grid-cols-2 gap-2">
        {AREAS.map((area) => (
          <AreaCard
            key={area}
            area={area}
            score={
              area === "LC"
                ? resposta.tri_lc
                : area === "CH"
                  ? resposta.tri_ch
                  : area === "CN"
                    ? resposta.tri_cn
                    : resposta.tri_mt
            }
            acertos={
              area === "LC"
                ? resposta.acertos_lc
                : area === "CH"
                  ? resposta.acertos_ch
                  : area === "CN"
                    ? resposta.acertos_cn
                    : resposta.acertos_mt
            }
          />
        ))}
      </div>

      {/* Totais */}
      <div className="rounded-2xl border-2 bg-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Resumo de respostas
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-black text-emerald-600">
              {totais.acertos}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground">
              Acertos
            </p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-600">{totais.erros}</p>
            <p className="text-[10px] font-bold text-muted-foreground">Erros</p>
          </div>
          <div>
            <p className="text-2xl font-black text-muted-foreground">
              {totais.branco}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground">
              Branco
            </p>
          </div>
        </div>
      </div>

      {/* Mapa de erros por topico */}
      {topTopicos.length > 0 && (
        <div className="rounded-2xl border-2 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Onde voce mais errou (top 5)
          </p>
          <ul className="space-y-2">
            {topTopicos.map(([topico, count]) => {
              const max = topTopicos[0]![1];
              const pct = (count / max) * 100;
              return (
                <li key={topico}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-semibold text-foreground">
                      {topico}
                    </span>
                    <span className="font-black text-red-600 ml-2">
                      {count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Itens com erro (detalhado, colapsado visualmente) */}
      {erroItens.length > 0 && (
        <details className="rounded-2xl border-2 bg-card p-3">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Ver gabarito das questoes erradas ({erroItens.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {erroItens.map((it) => (
              <li
                key={it.numero}
                className="flex items-center gap-2 rounded-md bg-red-50 px-2 py-1"
              >
                <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <span className="w-8 font-mono font-bold">{it.numero}</span>
                <span className="flex-1 min-w-0 truncate text-muted-foreground">
                  {it.topico ?? AREA_LABELS[areaOfNumero(it.numero) ?? "LC"]}
                </span>
                <span className="font-semibold text-muted-foreground">
                  {it.resposta_aluno ?? "—"}
                </span>
                <span className="font-black text-emerald-600">
                  {it.gabarito}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* CTA acertou corretas */}
      {data.itens && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700">
            Você acertou{" "}
            <strong className="font-black">{totais.acertos}</strong> de 180
            questões.
          </p>
        </div>
      )}
    </div>
  );
}
