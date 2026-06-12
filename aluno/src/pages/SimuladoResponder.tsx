/**
 * Pagina de preenchimento do gabarito pelo aluno (Fase 4).
 *
 * Estrategia:
 *   - Agrupa os 180 itens em 4 abas (LC, CH, CN, MT), 45 por aba.
 *   - Cada item e um grupo de 5 botoes radio (A..E).
 *   - Progresso visivel por aba + total.
 *   - Dica: nao pedimos 180 obrigatorios (aluno pode deixar em branco —
 *     o motor TRI trata como nao-respondidas).
 *   - Submit chama useSubmitSimulado (Edge Function autoritativa).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  useSimuladoResultado,
  useSubmitSimulado,
} from "@/hooks/useSimulados";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check } from "lucide-react";
import { AREA_LABELS, AREA_RANGES, type AreaKey } from "@/types/simulado";

const AREAS: readonly AreaKey[] = ["LC", "CH", "CN", "MT"];
const LETTERS = ["A", "B", "C", "D", "E"] as const;

function draftKey(simuladoId: string): string {
  return `simulado-draft-${simuladoId}`;
}

function loadDraft(simuladoId: string | undefined): Record<string, string> {
  if (!simuladoId) return {};
  try {
    const raw = sessionStorage.getItem(draftKey(simuladoId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export default function SimuladoResponder() {
  const { id: simuladoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSimuladoResultado(simuladoId);
  const submit = useSubmitSimulado();

  const [activeArea, setActiveArea] = useState<AreaKey>("LC");
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    loadDraft(simuladoId),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Rascunho local: refresh/navegacao acidental nao perde as marcacoes.
  useEffect(() => {
    if (!simuladoId) return;
    try {
      sessionStorage.setItem(draftKey(simuladoId), JSON.stringify(answers));
    } catch {
      // storage cheio/indisponivel: segue sem rascunho
    }
  }, [answers, simuladoId]);

  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (answeredCount === 0) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [answeredCount]);

  const progress = useMemo(() => {
    const total = 180;
    const answered = Object.values(answers).filter(
      (v) => v === "A" || v === "B" || v === "C" || v === "D" || v === "E",
    ).length;
    const porArea: Record<AreaKey, number> = { LC: 0, CH: 0, CN: 0, MT: 0 };
    for (const [key, value] of Object.entries(answers)) {
      const n = Number(key);
      const area = AREAS.find(
        (a) => n >= AREA_RANGES[a].start && n <= AREA_RANGES[a].end,
      );
      if (area && LETTERS.includes(value as "A")) porArea[area]++;
    }
    return { answered, total, porArea };
  }, [answers]);

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (data?.submitted) {
    // Aluno ja respondeu → redireciona pro resultado
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-sm font-black text-emerald-700">
            Voce ja respondeu este simulado.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/simulados/${simuladoId}/resultado`)}
            className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"
          >
            Ver meu resultado
          </button>
          <button
            type="button"
            onClick={() => navigate("/simulados")}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground"
          >
            Voltar para simulados
          </button>
        </div>
      </div>
    );
  }

  if (!data?.simulado) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-black text-red-700">
            Simulado nao encontrado ou nao disponivel.
          </p>
        </div>
      </div>
    );
  }

  const handleLetter = (numero: number, letter: string): void => {
    setAnswers((prev) => ({ ...prev, [String(numero)]: letter }));
  };

  const handleSubmit = (): void => {
    if (!simuladoId) return;
    submit.mutate(
      { simuladoId, answers },
      {
        onSuccess: () => {
          try {
            sessionStorage.removeItem(draftKey(simuladoId));
          } catch {
            // ignora: rascunho orfao nao causa problema
          }
          navigate(`/simulados/${simuladoId}/resultado`);
        },
      },
    );
  };

  const handleBack = (): void => {
    if (
      answeredCount > 0 &&
      !window.confirm(
        `Você marcou ${answeredCount} resposta(s). Quer mesmo sair? Suas marcações ficam salvas neste dispositivo até você enviar.`,
      )
    ) {
      return;
    }
    navigate("/simulados");
  };

  const range = AREA_RANGES[activeArea];

  return (
    <div className="pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar"
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground leading-tight truncate">
              {data.simulado.title}
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {progress.answered} / 180 respondidas
            </p>
          </div>
        </div>

        {/* Tabs por area */}
        <div className="mt-3 flex gap-1" role="tablist">
          {AREAS.map((a) => {
            const count = progress.porArea[a];
            const active = activeArea === a;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveArea(a)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <div>{a}</div>
                <div className="text-[9px] font-semibold opacity-80">
                  {count}/45
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {submit.isError && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          <p className="font-bold">Não foi possível enviar.</p>
          <p>
            Verifique sua conexão e tente de novo. Suas respostas continuam
            salvas neste aparelho.
          </p>
        </div>
      )}

      {/* Grid de 45 itens da area ativa */}
      <div className="p-4 space-y-2" role="tabpanel" aria-label={AREA_LABELS[activeArea]}>
        <p className="text-[11px] font-bold uppercase text-muted-foreground">
          {AREA_LABELS[activeArea]} (questões {range.start}–{range.end})
        </p>
        {Array.from({ length: range.end - range.start + 1 }, (_, i) => {
          const numero = range.start + i;
          const current = answers[String(numero)] ?? "";
          return (
            <div
              key={numero}
              className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5"
            >
              <span className="w-7 text-center text-xs font-mono font-bold text-muted-foreground">
                {numero}
              </span>
              <div
                role="radiogroup"
                aria-label={`Resposta da questão ${numero}`}
                className="flex items-center gap-1"
              >
                {LETTERS.map((letter) => {
                  const selected = current === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleLetter(numero, letter)}
                      className={`h-8 w-8 rounded-md border text-xs font-bold transition-all active:scale-95 ${
                        selected
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit sticky */}
      <div className="fixed bottom-16 left-0 right-0 z-30 mx-auto max-w-lg px-4">
        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={submit.isPending}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60"
          >
            Revisar e enviar ({progress.answered}/180)
          </button>
        ) : (
          <div className="rounded-xl border-2 border-primary bg-card p-3 shadow-2xl space-y-2">
            <p className="text-xs font-bold text-foreground">
              Confirmar envio?
            </p>
            <p className="text-[10px] text-muted-foreground">
              {progress.answered < 180
                ? `Voce deixou ${180 - progress.answered} em branco — essas questões entram como não respondidas.`
                : "Todas as 180 respondidas."}
              {"\n"}Apos enviar, nao da para alterar.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submit.isPending}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submit.isPending}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white flex items-center justify-center gap-1"
              >
                {submit.isPending ? (
                  "Enviando..."
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Confirmar envio
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
