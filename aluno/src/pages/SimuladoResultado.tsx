/**
 * Pagina de resultado do simulado do aluno — design jovem/gamificado (Batch 1).
 *
 * Redesign mobile-first com linguagem visual Duolingo:
 * - Hero colorido com SpeechBubble GRANDE em cima do mascote
 * - Nota TRI gigante em gradient colorido
 * - Cards de area com emojis + borders laterais por nivel
 * - Alerta branco gamificado (nao banner serio)
 * - Top topicos com emojis por posicao (ranking)
 * - Progress bar visual acertos/erros/branco
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useSimuladoResultado } from "@/hooks/useSimulados";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useSisuGoal } from "@/hooks/useSisuGoal";
import { Skeleton } from "@/components/ui/skeleton";
import { SisuThermometer } from "@/components/SisuThermometer";
import { ArrowLeft, XCircle, Info, Target, TrendingUp } from "lucide-react";
import {
  AREA_LABELS,
  areaOfNumero,
  type AreaKey,
  type SimuladoResultadoItem,
} from "@/types/simulado";
import {
  buildThermometerData,
  getUniversidade,
  mediaEnemComRedacao,
  REDACAO_HARDCODED,
} from "@/services/sisu-data";

const AREAS: readonly AreaKey[] = ["LC", "CH", "CN", "MT"];

const TRI_MIN = 200;
const TRI_MAX = 1000;

// ---------------------------------------------------------------------------
// Estetica por area
// ---------------------------------------------------------------------------

const AREA_META: Readonly<
  Record<
    AreaKey,
    {
      readonly emoji: string;
      readonly short: string;
      readonly borderClass: string;
      readonly bgClass: string;
      readonly accentClass: string;
    }
  >
> = {
  LC: {
    emoji: "📖",
    short: "Linguagens",
    borderClass: "border-l-blue-500",
    bgClass: "bg-blue-500/5",
    accentClass: "text-blue-600",
  },
  CH: {
    emoji: "🌎",
    short: "Humanas",
    borderClass: "border-l-orange-500",
    bgClass: "bg-orange-500/5",
    accentClass: "text-orange-600",
  },
  CN: {
    emoji: "🔬",
    short: "Natureza",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-500/5",
    accentClass: "text-emerald-600",
  },
  MT: {
    emoji: "🧮",
    short: "Matemática",
    borderClass: "border-l-purple-500",
    bgClass: "bg-purple-500/5",
    accentClass: "text-purple-600",
  },
};

// ---------------------------------------------------------------------------
// Niveis de proficiencia INEP
// ---------------------------------------------------------------------------

interface ProficiencyTier {
  readonly key: "abaixo" | "basico" | "adequado" | "avancado";
  readonly label: string;
  readonly emoji: string;
  readonly min: number;
  readonly max: number;
  readonly color: string;
  readonly bg: string;
  readonly heroBg: string;
  readonly desc: string;
}

const PROFICIENCY_TIERS: ReadonlyArray<ProficiencyTier> = [
  {
    key: "abaixo",
    label: "Abaixo do Básico",
    emoji: "🎯",
    min: 0,
    max: 449,
    color: "text-red-600",
    bg: "bg-red-500",
    heroBg:
      "bg-gradient-to-br from-red-100 via-orange-50 to-amber-50",
    desc: "Hora de focar nos fundamentos. Cada aula conta!",
  },
  {
    key: "basico",
    label: "Básico",
    emoji: "📚",
    min: 450,
    max: 549,
    color: "text-orange-600",
    bg: "bg-orange-500",
    heroBg:
      "bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50",
    desc: "Domínio elementar. Bora pro próximo nível!",
  },
  {
    key: "adequado",
    label: "Adequado",
    emoji: "💪",
    min: 550,
    max: 649,
    color: "text-blue-600",
    bg: "bg-blue-500",
    heroBg: "bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-50",
    desc: "Tá mandando bem! Cursos concorridos estão no radar.",
  },
  {
    key: "avancado",
    label: "Avançado",
    emoji: "🏆",
    min: 650,
    max: 1000,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    heroBg:
      "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-50",
    desc: "Nível de Medicina, Engenharias, Direito top. Continue!",
  },
];

function tierOf(score: number | null): ProficiencyTier | null {
  if (score == null) return null;
  return (
    PROFICIENCY_TIERS.find((t) => score >= t.min && score <= t.max) ??
    PROFICIENCY_TIERS[0]
  );
}

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
// Hero: speech bubble + mascote grande + nota gigante
// ---------------------------------------------------------------------------

interface HeroProps {
  readonly mediaGeral: number | null;
  readonly mediaTier: ProficiencyTier | null;
  readonly mediaGap: { points: number; tier: ProficiencyTier } | null;
  readonly onInfo: () => void;
}

function Hero({
  mediaGeral,
  mediaTier,
  mediaGap,
  onInfo,
}: HeroProps) {
  const heroBg = mediaTier?.heroBg ?? "bg-gradient-to-br from-primary/5 to-accent/5";
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 ${heroBg} px-4 py-4`}
    >
      {/* Decoracao canto sutil */}
      <div className="absolute -top-3 -right-3 text-6xl opacity-[0.08] rotate-12 select-none pointer-events-none">
        {mediaTier?.emoji ?? "📚"}
      </div>

      {mediaGeral != null && (
        <div className="relative flex flex-col items-center text-center gap-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Sua nota TRI
          </p>

          <div className="flex items-baseline gap-1 leading-none">
            <p className={`text-6xl font-black tracking-tight ${mediaTier?.color}`}>
              {mediaGeral.toFixed(0)}
            </p>
            <p className="text-xs font-bold text-muted-foreground">/1000</p>
          </div>
          <p
            className="text-[10px] font-semibold text-muted-foreground"
            title={`Média ENEM = (LC + CH + CN + MT + Redação ${REDACAO_HARDCODED}) / 5`}
          >
            c/ redação {REDACAO_HARDCODED}
          </p>

          <button
            type="button"
            onClick={onInfo}
            aria-label="Entenda os níveis de proficiência"
            className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${mediaTier?.bg} shadow-sm hover:scale-105 active:scale-95 transition-transform`}
          >
            <span className="text-base">{mediaTier?.emoji}</span>
            <span className="text-xs font-black text-white">
              {mediaTier?.label}
            </span>
            <Info className="h-3 w-3 text-white/90" />
          </button>

          {mediaGap && (
            <p className="text-[11px] font-bold text-foreground/80 flex items-center gap-1">
              <Target className="h-3 w-3 text-primary flex-shrink-0" />
              <span>
                +
                <strong className={`${mediaGap.tier.color} font-black`}>
                  {mediaGap.points}pts
                </strong>{" "}
                pra {mediaGap.tier.emoji}{" "}
                <span className="font-black">{mediaGap.tier.label}</span>
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaCard — border colorido + emoji + gauge bands + meta
// ---------------------------------------------------------------------------

interface AreaCardProps {
  readonly area: AreaKey;
  readonly score: number | null;
  readonly acertos: number;
}

const INEP_TICKS = [450, 550, 650] as const;

function AreaCard({ area, score, acertos }: AreaCardProps) {
  const meta = AREA_META[area];
  const pct = triToGaugePercent(score);
  const tier = tierOf(score);
  const gap = nextLevelGap(score);
  const extraAcertos = gap ? Math.max(1, Math.ceil(gap.points / 9)) : 0;

  return (
    <div
      className={`rounded-2xl border-2 border-l-[6px] ${meta.borderClass} ${meta.bgClass} p-3`}
    >
      {/* Header: emoji + label */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xl leading-none flex-shrink-0">
            {meta.emoji}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-black leading-tight ${meta.accentClass}`}>
              {area}
            </p>
            <p className="text-[9px] font-semibold text-muted-foreground leading-tight truncate">
              {meta.short}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-black leading-none ${tier?.color}`}>
            {formatScore(score)}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground leading-tight">
            {acertos}<span className="text-muted-foreground/60">/45</span>
          </p>
        </div>
      </div>

      {/* Gauge com bands */}
      <div className="relative mt-2.5 h-2">
        <div className="absolute inset-0 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {INEP_TICKS.map((t) => (
          <div
            key={t}
            aria-hidden="true"
            className="absolute top-0 h-2 w-px bg-background"
            style={{ left: `${triToGaugePercent(t)}%` }}
          />
        ))}
      </div>

      {/* Pill de nivel + meta */}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white ${tier?.bg}`}
        >
          <span>{tier?.emoji}</span>
          <span>{tier?.label}</span>
        </span>
        {gap && (
          <span className="text-[9px] font-bold text-muted-foreground">
            +<strong className={gap.tier.color}>{extraAcertos}</strong> ac ={" "}
            {gap.tier.emoji}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip modal niveis INEP
// ---------------------------------------------------------------------------

function ProficiencyInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Níveis de proficiência"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-black">Níveis de proficiência</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 hover:bg-muted"
          >
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-3">
          Baseado na metodologia INEP do ENEM.
        </p>
        <ul className="space-y-3">
          {PROFICIENCY_TIERS.map((t) => (
            <li
              key={t.key}
              className={`flex items-start gap-3 rounded-2xl border-l-4 ${t.bg.replace("bg-", "border-")} bg-card p-3 shadow-sm`}
            >
              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${t.color}`}>
                  {t.label}{" "}
                  <span className="text-xs font-bold text-muted-foreground">
                    ({t.min}–{t.max})
                  </span>
                </p>
                <p className="text-[11px] font-semibold text-foreground leading-snug mt-0.5">
                  {t.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
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
  const { data: sisuGoal } = useSisuGoal(student?.id);

  const [tierInfoOpen, setTierInfoOpen] = useState(false);

  // Top topico errado POR area (1 por area em vez de global)
  const topPorArea = useMemo<
    ReadonlyArray<{ area: AreaKey; topico: string; count: number }>
  >(() => {
    if (!data?.itens) return [];
    const byArea = new Map<AreaKey, Map<string, number>>();
    for (const it of data.itens) {
      if (it.correto || it.branco) continue;
      const t = (it.topico ?? "").trim();
      if (!t) continue;
      if (!byArea.has(it.area)) byArea.set(it.area, new Map());
      const m = byArea.get(it.area)!;
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return AREAS.flatMap((area) => {
      const m = byArea.get(area);
      if (!m || m.size === 0) return [];
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      if (!top) return [];
      return [{ area, topico: top[0], count: top[1] }];
    });
  }, [data]);

  const erroItens = useMemo<readonly SimuladoResultadoItem[]>(() => {
    if (!data?.itens) return [];
    return data.itens.filter((it) => !it.correto && !it.branco);
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
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
  // Media ENEM oficial: 4 areas + redacao (hardcoded 900 pra comparar com SISU)
  const mediaGeral = mediaEnemComRedacao({
    lc: resposta.tri_lc,
    ch: resposta.tri_ch,
    cn: resposta.tri_cn,
    mt: resposta.tri_mt,
  });
  const mediaTier = tierOf(mediaGeral);
  const mediaGap = nextLevelGap(mediaGeral);
  const muitosEmBranco = totais.branco > 30;

  // Dados do termometro SISU (se aluno tem meta cadastrada e universidade reconhecida)
  const sisuUni = getUniversidade(
    sisuGoal?.sisu_universidade ?? null,
    sisuGoal?.sisu_uf ?? null,
  );
  const thermometer =
    sisuUni && sisuGoal?.sisu_curso_nome && sisuGoal.sisu_nota_corte && mediaGeral != null
      ? buildThermometerData(sisuUni, mediaGeral)
      : null;

  const totalResp = totais.acertos + totais.erros + totais.branco;
  const pctAcertos = (totais.acertos / totalResp) * 100;
  const pctErros = (totais.erros / totalResp) * 100;

  return (
    <div className="pb-24 max-w-lg mx-auto">
      {/* Top bar compacta */}
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-4 py-2 border-b border-border/50">
        <button
          type="button"
          onClick={() => navigate("/simulados")}
          aria-label="Voltar"
          className="rounded-full p-1.5 hover:bg-muted active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground leading-tight truncate">
            {data.simulado?.title ?? "Simulado"}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">
            Resultado oficial (TRI)
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero — score + tier + gap (sem mascote, conforme feedback) */}
        <Hero
          mediaGeral={mediaGeral}
          mediaTier={mediaTier}
          mediaGap={mediaGap}
          onInfo={() => setTierInfoOpen(true)}
        />

        {/* Alerta branco */}
        {muitosEmBranco && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-3 animate-bounce-in"
          >
            <span className="text-3xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-900">
                {totais.branco} em branco!
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-amber-800 leading-tight">
                No ENEM, <strong>branco = erro</strong>. Mas chutar dá{" "}
                <strong>20% de chance</strong> de acerto. Da próxima, marque
                tudo!
              </p>
            </div>
          </div>
        )}

        {/* Cards das 4 areas */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Notas por área
            </p>
          </div>
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
        </div>

        {/* Totais com barra visual */}
        <div className="rounded-2xl border-2 bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
            Resumo das 180 respostas
          </p>
          {/* Barra de distribuicao */}
          <div className="flex h-4 overflow-hidden rounded-full">
            <div
              className="bg-emerald-500 flex items-center justify-center"
              style={{ width: `${pctAcertos}%` }}
              title={`${totais.acertos} acertos`}
            />
            <div
              className="bg-red-500"
              style={{ width: `${pctErros}%` }}
              title={`${totais.erros} erros`}
            />
            <div
              className="bg-muted"
              style={{ width: `${100 - pctAcertos - pctErros}%` }}
              title={`${totais.branco} em branco`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/10 p-2">
              <p className="text-2xl font-black text-emerald-600">
                {totais.acertos}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                acertos
              </p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-2">
              <p className="text-2xl font-black text-red-600">
                {totais.erros}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-red-700">
                erros
              </p>
            </div>
            <div className="rounded-xl bg-muted p-2">
              <p className="text-2xl font-black text-muted-foreground">
                {totais.branco}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                branco
              </p>
            </div>
          </div>
        </div>

        {/* Termometro SISU — meta do aluno (se cadastrada) */}
        {thermometer && sisuGoal?.sisu_curso_nome && sisuGoal.sisu_nota_corte && (
          <SisuThermometer
            data={thermometer}
            mediaEnem={mediaGeral ?? 0}
            metaCurso={sisuGoal.sisu_curso_nome}
            metaNotaCorte={Number(sisuGoal.sisu_nota_corte)}
          />
        )}

        {/* Top topico errado por AREA (1 card por area) */}
        {topPorArea.length > 0 && (
          <div className="rounded-2xl border-2 bg-card p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-lg">🎯</span>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Maior erro em cada área
              </p>
            </div>
            <ul className="space-y-2.5">
              {topPorArea.map((row) => {
                const meta = AREA_META[row.area];
                return (
                  <li
                    key={row.area}
                    className={`flex items-start gap-2 rounded-xl border-l-4 ${meta.borderClass} ${meta.bgClass} p-2.5`}
                  >
                    <span className="text-xl flex-shrink-0 leading-none mt-0.5">
                      {meta.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[10px] font-black uppercase tracking-wider ${meta.accentClass}`}
                        >
                          {row.area} · {meta.short}
                        </p>
                        <span className="text-[10px] font-black text-red-600 flex-shrink-0">
                          {row.count} erro{row.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-bold text-foreground leading-tight">
                        {row.topico}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Details gabarito erradas */}
        {erroItens.length > 0 && (
          <details className="rounded-2xl border-2 bg-card p-3">
            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Ver gabarito das erradas ({erroItens.length})
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
      </div>

      <ProficiencyInfoModal
        open={tierInfoOpen}
        onClose={() => setTierInfoOpen(false)}
      />
    </div>
  );
}
