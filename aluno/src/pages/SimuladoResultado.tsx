/**
 * Pagina de resultado do simulado do aluno (Fase 4 + Batch 1 improvements).
 *
 * Consome RPC `get_student_simulado_resultado` e renderiza:
 * - Mascote XTRI com fala contextual no topo (depende do desempenho)
 * - Alerta "branco é pior que erro no ENEM" se muitos em branco
 * - Média geral + nível proficiência INEP (com tooltip explicativo)
 * - 4 cards TRI por área com:
 *   - Gauge com bands INEP coloridas (450/550/650)
 *   - Meta até próximo nível ("Faltam 32pts para Básico")
 * - Resumo totais acertos/erros/branco
 * - Top 5 tópicos errados (bar chart)
 * - Details colapsavel com gabarito questao-a-questao
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useSimuladoResultado } from "@/hooks/useSimulados";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useGamification } from "@/hooks/useGamification";
import { Skeleton } from "@/components/ui/skeleton";
import { MascotAvatar } from "@/components/MascotAvatar";
import { SpeechBubble } from "@/components/SpeechBubble";
import { ArrowLeft, CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import {
  AREA_LABELS,
  areaOfNumero,
  type AreaKey,
  type SimuladoResultadoItem,
} from "@/types/simulado";

const AREAS: readonly AreaKey[] = ["LC", "CH", "CN", "MT"];

const TRI_MIN = 200;
const TRI_MAX = 1000;

// ---------------------------------------------------------------------------
// Niveis de proficiencia INEP
// ---------------------------------------------------------------------------

interface ProficiencyTier {
  readonly key: "abaixo" | "basico" | "adequado" | "avancado";
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly color: string;
  readonly bg: string;
  readonly desc: string;
}

const PROFICIENCY_TIERS: ReadonlyArray<ProficiencyTier> = [
  {
    key: "abaixo",
    label: "Abaixo do Básico",
    min: 0,
    max: 449,
    color: "text-red-600",
    bg: "bg-red-500",
    desc: "Não demonstra domínio mínimo das competências esperadas. Foco em fundamentos.",
  },
  {
    key: "basico",
    label: "Básico",
    min: 450,
    max: 549,
    color: "text-orange-600",
    bg: "bg-orange-500",
    desc: "Nível associado à certificação de conclusão do Ensino Médio. Domínio elementar.",
  },
  {
    key: "adequado",
    label: "Adequado",
    min: 550,
    max: 649,
    color: "text-blue-600",
    bg: "bg-blue-500",
    desc: "Domínio satisfatório. Consegue aplicar conhecimento em situações diversas.",
  },
  {
    key: "avancado",
    label: "Avançado",
    min: 650,
    max: 1000,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    desc: "Domínio pleno. Análise, reflexão e integração em alto nível de complexidade.",
  },
];

function tierOf(score: number | null): ProficiencyTier | null {
  if (score == null) return null;
  return (
    PROFICIENCY_TIERS.find((t) => score >= t.min && score <= t.max) ??
    PROFICIENCY_TIERS[0]
  );
}

/** Mensagem "faltam Xpts para {proximo nivel}". Null se ja no topo. */
function nextLevelGap(
  score: number | null,
): { readonly points: number; readonly tier: ProficiencyTier } | null {
  if (score == null) return null;
  const current = tierOf(score);
  if (!current || current.key === "avancado") return null;
  const nextIdx = PROFICIENCY_TIERS.findIndex((t) => t.key === current.key) + 1;
  const next = PROFICIENCY_TIERS[nextIdx];
  if (!next) return null;
  return { points: Math.ceil(next.min - score), tier: next };
}

function triToGaugePercent(score: number | null): number {
  if (score == null) return 0;
  const clamped = Math.max(TRI_MIN, Math.min(TRI_MAX, score));
  return ((clamped - TRI_MIN) / (TRI_MAX - TRI_MIN)) * 100;
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? score.toFixed(0) : "—";
}

// ---------------------------------------------------------------------------
// Mascote + mensagem contextual baseada no desempenho
// ---------------------------------------------------------------------------

interface MascotMessage {
  readonly message: string;
  readonly variant: "default" | "success" | "error";
  readonly animation: "idle" | "jump" | "hit";
}

function simuladoMascotMessage(
  media: number | null,
  totais: { acertos: number; erros: number; branco: number },
): MascotMessage {
  if (media == null) {
    return { message: "Vamos analisar seus acertos! 📊", variant: "default", animation: "idle" };
  }
  if (totais.branco > 60) {
    return {
      message: "Muita questão em branco 😮 No ENEM, chute é melhor que branco!",
      variant: "error",
      animation: "hit",
    };
  }
  if (media >= 650) {
    return { message: "Avançado! Você mandou MUITO bem! 🏆", variant: "success", animation: "jump" };
  }
  if (media >= 550) {
    return { message: "Adequado! Está no caminho, bora pro Avançado! 🚀", variant: "success", animation: "jump" };
  }
  if (media >= 450) {
    return { message: "Básico! Próximo passo é o Adequado 💪", variant: "default", animation: "idle" };
  }
  return {
    message: "Vamos treinar juntos. Cada erro é um aprendizado 📚",
    variant: "default",
    animation: "idle",
  };
}

// ---------------------------------------------------------------------------
// AreaCard com gauge INEP bands + meta próximo nível
// ---------------------------------------------------------------------------

interface AreaCardProps {
  readonly area: AreaKey;
  readonly score: number | null;
  readonly acertos: number;
}

// Marcadores 450/550/650 na escala TRI_MIN..TRI_MAX para overlay no gauge
const INEP_TICKS = [450, 550, 650] as const;

function AreaCard({ area, score, acertos }: AreaCardProps) {
  const pct = triToGaugePercent(score);
  const tier = tierOf(score);
  const gap = nextLevelGap(score);
  // Estima acertos necessarios: 1 acerto ≈ (max-min)/45 pontos para area.
  // Aproximacao grosseira mas util pedagogicamente.
  const extraAcertos = gap ? Math.max(1, Math.ceil(gap.points / 9)) : 0;

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
          <p className={`text-2xl font-black ${tier?.color ?? "text-muted-foreground"}`}>
            {formatScore(score)}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground">
            {acertos}/45 acertos
          </p>
        </div>
      </div>

      {/* Gauge com INEP bands */}
      <div className="relative mt-2 h-2.5">
        <div className="absolute inset-0 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Tick marks INEP (450 / 550 / 650) */}
        {INEP_TICKS.map((t) => {
          const x = triToGaugePercent(t);
          return (
            <div
              key={t}
              aria-hidden="true"
              className="absolute top-0 h-2.5 w-px bg-background/90"
              style={{ left: `${x}%` }}
            />
          );
        })}
      </div>

      {/* Labels dos niveis abaixo do gauge */}
      <div className="mt-1 flex justify-between text-[8px] font-bold text-muted-foreground">
        <span>B.</span>
        <span>bás</span>
        <span>ad</span>
        <span>av</span>
      </div>

      {/* Nivel atual */}
      <p className={`mt-1.5 text-[10px] font-bold ${tier?.color ?? "text-muted-foreground"}`}>
        {tier?.label ?? "—"}
      </p>

      {/* Meta proximo nivel */}
      {gap && (
        <div className="mt-1.5 rounded-md bg-muted/50 px-2 py-1">
          <p className="text-[9px] font-semibold text-muted-foreground leading-tight">
            Faltam <strong className={`${gap.tier.color}`}>{gap.points}pts</strong> para{" "}
            <span className="font-black">{gap.tier.label}</span>
          </p>
          <p className="text-[9px] text-muted-foreground leading-tight">
            ≈ <strong>{extraAcertos}</strong> acerto{extraAcertos === 1 ? "" : "s"} a mais
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProficiencyInfoButton — tooltip (mobile-friendly via click)
// ---------------------------------------------------------------------------

function ProficiencyInfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="O que significam os níveis de proficiência?"
        aria-expanded={open}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted active:bg-muted/70"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="tooltip"
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border-2 bg-card p-3 shadow-xl"
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
              Níveis de proficiência (INEP)
            </p>
            <ul className="space-y-2">
              {PROFICIENCY_TIERS.map((t) => (
                <li key={t.key} className="flex items-start gap-2">
                  <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${t.bg}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black ${t.color}`}>
                      {t.label}{" "}
                      <span className="font-semibold text-muted-foreground">
                        ({t.min}–{t.max})
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {t.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export default function SimuladoResultado() {
  const { id: simuladoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSimuladoResultado(simuladoId);
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: gamification } = useGamification(studentKey);
  const level = gamification?.level ?? 1;

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
            {error?.message ?? "Você ainda não submeteu este simulado."}
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
  const mediaTier = tierOf(mediaGeral);
  const mediaGap = nextLevelGap(mediaGeral);
  const mascot = simuladoMascotMessage(mediaGeral, totais);

  // Threshold pedagogico: >30 branco significa ~17% da prova em branco
  const muitosEmBranco = totais.branco > 30;

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

      {/* Mascote com fala contextual */}
      <div className="flex items-start gap-3 rounded-2xl border-2 bg-gradient-to-br from-primary/5 to-accent/5 p-3">
        <div className="flex-shrink-0">
          <MascotAvatar level={level} animation={mascot.animation} size={72} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <SpeechBubble message={mascot.message} variant={mascot.variant} />
        </div>
      </div>

      {/* Alerta branco é pior que erro */}
      {muitosEmBranco && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-amber-900">
              {totais.branco} questões em branco
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-amber-800 leading-tight">
              No ENEM, deixar em branco e errar dão o mesmo resultado (zero). Mas
              <strong> chutar em branco dá 20% de chance </strong>
              de acertar. Da próxima, marque algo em TODAS as questões!
            </p>
          </div>
        </div>
      )}

      {/* Media geral com tooltip */}
      {mediaGeral != null && (
        <div className="rounded-2xl border-2 bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-center relative">
          <div className="absolute top-2 right-2">
            <ProficiencyInfoButton />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Média geral
          </p>
          <p className={`text-4xl font-black ${mediaTier?.color ?? "text-muted-foreground"}`}>
            {mediaGeral.toFixed(0)}
          </p>
          <p className={`text-xs font-bold ${mediaTier?.color ?? "text-muted-foreground"}`}>
            {mediaTier?.label ?? "—"}
          </p>
          {mediaGap && (
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
              Faltam <strong className={mediaGap.tier.color}>{mediaGap.points}pts</strong>{" "}
              para <span className="font-black">{mediaGap.tier.label}</span>
            </p>
          )}
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
            <p className="text-2xl font-black text-emerald-600">{totais.acertos}</p>
            <p className="text-[10px] font-bold text-muted-foreground">Acertos</p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-600">{totais.erros}</p>
            <p className="text-[10px] font-bold text-muted-foreground">Erros</p>
          </div>
          <div>
            <p className="text-2xl font-black text-muted-foreground">{totais.branco}</p>
            <p className="text-[10px] font-bold text-muted-foreground">Branco</p>
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
                    <span className="truncate font-semibold text-foreground">{topico}</span>
                    <span className="font-black text-red-600 ml-2">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Details gabarito das erradas */}
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
                <span className="font-black text-emerald-600">{it.gabarito}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.itens && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700">
            Você acertou <strong className="font-black">{totais.acertos}</strong> de 180 questões.
          </p>
        </div>
      )}
    </div>
  );
}
