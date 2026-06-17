/**
 * Pagina de listagem de simulados disponiveis para o aluno (Fase 4).
 */

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSimuladosPendentes } from "@/hooks/useSimulados";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useSisuGoal, type SisuGoal } from "@/hooks/useSisuGoal";
import { useSisuCursos } from "@/hooks/useSisuCatalogo";
import { useSetSisuGoal } from "@/hooks/useSetSisuGoal";
import { Skeleton } from "@/components/ui/skeleton";
import { SisuGoalCTA } from "@/components/SisuGoalCTA";
import { SisuGoalPicker } from "@/components/SisuGoalPicker";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  History,
  PencilLine,
  Target,
} from "lucide-react";
import type { SimuladoPendenteRow } from "@/types/simulado";

function normalizeSisuText(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

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

function getDraftCount(simuladoId: string): number {
  try {
    const raw = sessionStorage.getItem(`simulado-draft-${simuladoId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    return Object.values(parsed).filter((value) =>
      value === "A" || value === "B" || value === "C" || value === "D" || value === "E",
    ).length;
  } catch {
    return 0;
  }
}

function SimuladoCard({
  sim,
  index,
  draftCount,
  onOpen,
}: {
  readonly sim: SimuladoPendenteRow;
  readonly index: number;
  readonly draftCount: number;
  readonly onOpen: () => void;
}) {
  const isDone = sim.ja_respondeu;
  const isDraft = !isDone && draftCount > 0;
  const label = isDone
    ? "Resultado TRI"
    : isDraft
      ? `Continuar (${draftCount}/180)`
      : "Preencher gabarito";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={
          isDone
            ? `Ver resultado de ${sim.title}`
            : isDraft
              ? `Continuar rascunho de ${sim.title}`
              : `Responder ${sim.title}`
        }
        className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] animate-fade-in ${
          isDone
            ? "border-emerald-500/40 bg-emerald-500/5"
            : isDraft
              ? "border-accent/50 bg-accent/10"
              : "border-primary bg-primary/5 hover:bg-primary/10"
        }`}
        style={{
          animationDelay: `${index * 0.08}s`,
          animationFillMode: "both",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">
            {isDone ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            ) : isDraft ? (
              <PencilLine className="h-7 w-7 text-accent" />
            ) : (
              <FileText className="h-7 w-7 text-primary" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground leading-tight">
              {sim.title}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              {isDone
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
              isDone ? "text-emerald-600" : isDraft ? "text-accent" : "text-primary"
            }`}
          >
            {label}
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
  );
}

function SisuGoalSummary({
  goal,
  isLoading,
  studentId,
  onSaved,
}: {
  readonly goal: SisuGoal | null | undefined;
  readonly isLoading: boolean;
  readonly studentId: string | undefined;
  readonly onSaved: () => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const notaCorte =
    typeof goal?.sisu_nota_corte === "number" && Number.isFinite(goal.sisu_nota_corte)
      ? Math.round(goal.sisu_nota_corte)
      : null;
  const sigla = goal?.sisu_universidade ?? undefined;
  const uf = goal?.sisu_uf ?? undefined;
  const { data: cursos = [], isLoading: isLoadingCursos } = useSisuCursos(sigla, uf);
  const { mutateAsync, isPending } = useSetSisuGoal(studentId);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  if (!goal?.sisu_curso_nome) {
    return <SisuGoalCTA studentId={studentId} onSaved={onSaved} />;
  }

  async function selecionarCurso(curso: string) {
    if (!sigla || !uf || normalizeSisuText(curso) === normalizeSisuText(goal?.sisu_curso_nome)) {
      return;
    }

    setSelectionError(null);
    try {
      await mutateAsync({ sigla, uf, curso });
      onSaved();
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Falha ao salvar o curso.");
    }
  }

  return (
    <section className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">
            Meta SISU
          </p>
          <p className="mt-1 text-sm font-black leading-tight text-foreground">
            {goal.sisu_curso_nome}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {[goal.sisu_universidade, goal.sisu_uf].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            {notaCorte
              ? `Nota de corte: ${notaCorte} pts`
              : "Nota de corte em atualização."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="flex flex-shrink-0 items-center gap-1 rounded-xl border-2 border-primary/30 px-3 py-2 text-[11px] font-black text-primary hover:bg-primary/10"
        >
          <PencilLine className="h-3.5 w-3.5" />
          Editar
        </button>
      </div>

      <div className="mt-4 border-t border-primary/15 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">
              Ranking de cursos
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
              {sigla && uf ? `${sigla} · ${uf}` : "Universidade em atualização"}
            </p>
          </div>
          {isLoadingCursos && (
            <span className="text-[10px] font-bold text-muted-foreground">
              Carregando...
            </span>
          )}
        </div>

        {!isLoadingCursos && cursos.length > 0 && (
          <ul className="mt-3 max-h-56 space-y-1 overflow-auto pr-1">
            {cursos.map((curso, index) => {
              const selected =
                normalizeSisuText(curso.curso) === normalizeSisuText(goal.sisu_curso_nome);
              return (
                <li key={curso.curso}>
                  <button
                    type="button"
                    onClick={() => selecionarCurso(curso.curso)}
                    disabled={isPending || selected}
                    className={`grid w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors ${
                      selected
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-primary/15 bg-background/70 text-foreground hover:bg-primary/10"
                    }`}
                    aria-label={
                      selected
                        ? `${curso.curso}, meta atual`
                        : `Escolher ${curso.curso} como meta SISU`
                    }
                  >
                    <span className="font-mono font-black text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="min-w-0 font-black leading-tight">
                      {curso.curso}
                    </span>
                    <span className="font-mono text-[11px] font-black text-muted-foreground">
                      {Math.round(curso.nota_corte)} pts
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoadingCursos && cursos.length === 0 && (
          <p className="mt-3 rounded-xl border border-primary/15 bg-background/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            Lista de cursos indisponível para esta universidade.
          </p>
        )}

        {selectionError && (
          <p role="alert" className="mt-2 text-[11px] font-semibold text-red-600">
            {selectionError}
          </p>
        )}
      </div>

      <SisuGoalPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        studentId={studentId}
        initialGoal={goal}
        onSaved={() => {
          onSaved();
          setIsPickerOpen(false);
        }}
      />
    </section>
  );
}

export default function Simulados() {
  const { data: simulados, isLoading, error, refetch } = useSimuladosPendentes();
  const { data: student, isLoading: isLoadingStudent } = useStudentProfile();
  const { data: sisuGoal, isLoading: isLoadingSisuGoal } = useSisuGoal(student?.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const handleSisuGoalSaved = () => {
    void queryClient.invalidateQueries({ queryKey: ["sisu-goal", student?.id] });
    void queryClient.invalidateQueries({ queryKey: ["student-profile"] });
  };

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
          <p className="mt-1 text-xs">
            Verifique sua conexão com a internet e tente de novo.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const list = simulados ?? [];
  const draftsById = Object.fromEntries(list.map((sim) => [sim.id, getDraftCount(sim.id)]));
  const draftList = list.filter((sim) => !sim.ja_respondeu && draftsById[sim.id] > 0);
  const pendingList = list.filter((sim) => !sim.ja_respondeu && draftsById[sim.id] === 0);
  const doneList = list.filter((sim) => sim.ja_respondeu);

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

      <SisuGoalSummary
        goal={sisuGoal}
        isLoading={isLoadingStudent || isLoadingSisuGoal}
        studentId={student?.id}
        onSaved={handleSisuGoalSaved}
      />

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
        <div className="space-y-5">
          {draftList.length > 0 && (
            <SimuladoSection title="Continuar rascunho" count={draftList.length}>
              {draftList.map((sim, idx) => (
                <SimuladoCard
                  key={sim.id}
                  sim={sim}
                  index={idx}
                  draftCount={draftsById[sim.id]}
                  onOpen={() => navigate(`/simulados/${sim.id}/responder`)}
                />
              ))}
            </SimuladoSection>
          )}

          {pendingList.length > 0 && (
            <SimuladoSection title="Para responder" count={pendingList.length}>
              {pendingList.map((sim, idx) => (
                <SimuladoCard
                  key={sim.id}
                  sim={sim}
                  index={idx}
                  draftCount={0}
                  onOpen={() => navigate(`/simulados/${sim.id}/responder`)}
                />
              ))}
            </SimuladoSection>
          )}

          {doneList.length > 0 && (
            <SimuladoSection title="Resultados disponíveis" count={doneList.length}>
              {doneList.map((sim, idx) => (
                <SimuladoCard
                  key={sim.id}
                  sim={sim}
                  index={idx}
                  draftCount={0}
                  onOpen={() => navigate(`/simulados/${sim.id}/resultado`)}
                />
              ))}
            </SimuladoSection>
          )}
        </div>
      )}
    </div>
  );
}

function SimuladoSection({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
          {count}
        </span>
      </div>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}
