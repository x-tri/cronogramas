/**
 * Pagina de listagem de simulados disponiveis para o aluno (Fase 4).
 */

import { useNavigate } from "react-router-dom";
import { useSimuladosPendentes } from "@/hooks/useSimulados";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, Download, FileText, History } from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "";
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

export default function Simulados() {
  const { data: simulados, isLoading, error } = useSimuladosPendentes();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
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
          <p className="font-bold">Não foi possível carregar os simulados.</p>
          <p className="mt-1 text-xs">{error.message}</p>
        </div>
      </div>
    );
  }

  const list = simulados ?? [];

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground">Simulados ENEM</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Baixe o caderno e registre suas respostas aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/simulados/historico")}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border-2 border-primary/30 px-3 py-2 text-xs font-black text-primary hover:bg-primary/5"
          data-testid="historico-link"
        >
          <History className="h-3.5 w-3.5" />
          Histórico TRI
        </button>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-bounce-in">
          <div className="text-5xl mb-3 animate-float">📋</div>
          <p className="text-lg font-black text-foreground">
            Nenhum simulado disponível
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Quando o seu coordenador liberar um simulado, ele aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((sim, idx) => (
            <li key={sim.id}>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    sim.ja_respondeu
                      ? `/simulados/${sim.id}/resultado`
                      : `/simulados/${sim.id}/responder`,
                  )
                }
                aria-label={
                  sim.ja_respondeu
                    ? `Ver resultado de ${sim.title}`
                    : `Responder ${sim.title}`
                }
                className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] animate-fade-in ${
                  sim.ja_respondeu
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-primary bg-primary/5 hover:bg-primary/10"
                }`}
                style={{
                  animationDelay: `${idx * 0.08}s`,
                  animationFillMode: "both",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">
                    {sim.ja_respondeu ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    ) : (
                      <FileText className="h-7 w-7 text-primary" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground leading-tight">
                      {sim.title}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                      {sim.ja_respondeu
                        ? `Enviado em ${formatDate(sim.submitted_at)}`
                        : `Publicado em ${formatDate(sim.published_at)}`}
                    </p>
                    {sim.turmas.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Turmas: {sim.turmas.join(", ")}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      sim.ja_respondeu ? "text-emerald-600" : "text-primary"
                    }`}
                  >
                    {sim.ja_respondeu ? "Ver meu resultado" : "Preencher gabarito"}
                  </span>
                  {sim.caderno_url && (
                    <a
                      href={sim.caderno_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-[10px] font-black text-primary hover:bg-primary/5 transition-colors"
                      aria-label={`Baixar caderno de ${sim.title}`}
                    >
                      <Download className="h-3 w-3" />
                      Baixar Caderno
                    </a>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
