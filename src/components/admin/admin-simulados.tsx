/**
 * AdminSimulados — listagem de simulados ENEM (Fase 3.1).
 *
 * Fluxo:
 *   1. super_admin: escolhe escola no filtro, ve todos os simulados da escola.
 *      coordinator: escopo fixo a sua escola (userSchoolId).
 *   2. Cards exibem: titulo, turmas alvo, status, contagem de respostas.
 *   3. CTA "Criar simulado" atualmente mostra placeholder (Fase 3.2 implementa
 *      o wizard de criacao).
 *
 * Dados: direto via supabase client. RLS (migration 016) ja escopa; o filtro
 * client-side por school_id e apenas conveniencia de UX para super_admin.
 */

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase";
import { SimuladoWizard } from "./simulado-wizard";

type SimuladoStatus = "draft" | "published" | "closed";

interface School {
  readonly id: string;
  readonly name: string;
}

interface SimuladoRow {
  readonly id: string;
  readonly title: string;
  readonly school_id: string;
  readonly turmas: readonly string[];
  readonly status: SimuladoStatus;
  readonly published_at: string | null;
  readonly created_at: string;
  /** Supabase nested count: [{ count: number }] ou vazio */
  readonly simulado_respostas?: ReadonlyArray<{ count: number }>;
}

interface AdminSimuladosProps {
  readonly userRole?: string | null;
  readonly userSchoolId?: string | null;
}

const STATUS_FILTERS: ReadonlyArray<{ value: SimuladoStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "closed", label: "Encerrado" },
];

const STATUS_STYLES: Readonly<Record<SimuladoStatus, { bg: string; fg: string; label: string }>> = {
  draft:     { bg: "bg-[#f4f4f5]", fg: "text-[#71717a]", label: "Rascunho" },
  published: { bg: "bg-[#dcfce7]", fg: "text-[#166534]", label: "Publicado" },
  closed:    { bg: "bg-[#fee2e2]", fg: "text-[#991b1b]", label: "Encerrado" },
};

function countRespostas(row: SimuladoRow): number {
  return row.simulado_respostas?.[0]?.count ?? 0;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AdminSimulados({
  userRole = null,
  userSchoolId = null,
}: AdminSimuladosProps) {
  const isSchoolScoped = userRole !== "super_admin" && Boolean(userSchoolId);

  const [schools, setSchools] = useState<ReadonlyArray<School>>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<SimuladoStatus | "all">("all");
  const [simulados, setSimulados] = useState<ReadonlyArray<SimuladoRow>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [reloadTick, setReloadTick] = useState<number>(0);

  // super_admin: carrega lista de escolas para filtro.
  useEffect(() => {
    if (isSchoolScoped) return;
    let cancelled = false;
    supabase
      .from("schools")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (cancelled) return;
        setSchools((data ?? []) as School[]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSchoolScoped]);

  const effectiveSchoolId = useMemo<string>(() => {
    if (isSchoolScoped && userSchoolId) return userSchoolId;
    return selectedSchool;
  }, [isSchoolScoped, userSchoolId, selectedSchool]);

  // Carrega simulados sempre que mudam os filtros. Logica inline para evitar
  // o lint `set-state-in-effect` (callback delegando a funcao memoizada).
  useEffect(() => {
    let cancelled = false;

    let query = supabase
      .from("simulados")
      .select(
        "id, title, school_id, turmas, status, published_at, created_at, simulado_respostas(count)",
      )
      .order("created_at", { ascending: false });

    if (effectiveSchoolId) {
      query = query.eq("school_id", effectiveSchoolId);
    }
    if (selectedStatus !== "all") {
      query = query.eq("status", selectedStatus);
    }

    query.then(({ data, error: queryError }) => {
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setSimulados([]);
      } else {
        setError(null);
        setSimulados((data ?? []) as SimuladoRow[]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveSchoolId, selectedStatus, reloadTick]);

  const handleCreate = (): void => {
    setWizardOpen(true);
  };

  const handleWizardCreated = (): void => {
    setReloadTick((n) => n + 1);
  };

  const schoolNameById = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const s of schools) m[s.id] = s.name;
    return m;
  }, [schools]);

  return (
    <div className="space-y-6">
      {/* Filtros + acao */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Filtro de escola (so super_admin) */}
          {!isSchoolScoped && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="sim-school-filter"
                className="text-xs font-medium text-[#71717a]"
              >
                Escola
              </label>
              <select
                id="sim-school-filter"
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] min-w-[220px]"
              >
                <option value="">Todas as escolas</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de status */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sim-status-filter"
              className="text-xs font-medium text-[#71717a]"
            >
              Status
            </label>
            <select
              id="sim-status-filter"
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as SimuladoStatus | "all")
              }
              className="rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] min-w-[160px]"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
          aria-label="Criar simulado"
        >
          + Criar Simulado
        </button>
      </div>

      {/* Conteudo */}
      {loading && (
        <div
          role="status"
          aria-label="Carregando simulados"
          className="flex items-center justify-center py-20"
        >
          <span className="text-sm text-[#71717a]">Carregando...</span>
        </div>
      )}

      {!loading && error !== null && (
        <div
          role="alert"
          className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]"
        >
          Falha ao carregar simulados: {error}
        </div>
      )}

      {!loading && error === null && simulados.length === 0 && (
        <EmptyState onCreate={handleCreate} />
      )}

      {!loading && error === null && simulados.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {simulados.map((sim) => (
            <li key={sim.id}>
              <SimuladoCard
                simulado={sim}
                schoolName={schoolNameById[sim.school_id] ?? "—"}
              />
            </li>
          ))}
        </ul>
      )}

      <SimuladoWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleWizardCreated}
        schools={schools}
        isSchoolScoped={isSchoolScoped}
        lockedSchoolId={isSchoolScoped ? (userSchoolId ?? null) : null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  readonly onCreate: () => void;
}

function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label="Nenhum simulado encontrado"
      className="rounded-lg border border-dashed border-[#e5e7eb] bg-white px-6 py-16 text-center"
    >
      <p className="text-base font-medium text-[#1d1d1f]">
        Nenhum simulado encontrado
      </p>
      <p className="mt-2 text-sm text-[#71717a]">
        Crie um simulado ENEM (gabarito + conteudo oficial) para liberar correcao
        automatica aos alunos.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
      >
        + Criar simulado
      </button>
    </div>
  );
}

interface SimuladoCardProps {
  readonly simulado: SimuladoRow;
  readonly schoolName: string;
}

function SimuladoCard({ simulado, schoolName }: SimuladoCardProps) {
  const style = STATUS_STYLES[simulado.status];
  const respostas = countRespostas(simulado);
  const turmasLabel =
    simulado.turmas.length === 0
      ? "Todas as turmas"
      : simulado.turmas.join(", ");

  return (
    <article className="flex h-full flex-col rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[#1d1d1f] leading-tight">
          {simulado.title}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.fg}`}
          aria-label={`Status: ${style.label}`}
        >
          {style.label}
        </span>
      </header>

      <dl className="mt-3 space-y-1.5 text-xs text-[#71717a]">
        <div className="flex items-center gap-2">
          <dt className="font-medium">Escola:</dt>
          <dd className="truncate text-[#1d1d1f]">{schoolName}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium">Turmas:</dt>
          <dd className="truncate text-[#1d1d1f]">{turmasLabel}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium">Publicado:</dt>
          <dd className="text-[#1d1d1f]">{formatDate(simulado.published_at)}</dd>
        </div>
      </dl>

      <footer className="mt-4 flex items-center justify-between border-t border-[#f4f4f5] pt-3">
        <span className="text-xs text-[#71717a]">
          <span
            className="font-semibold text-[#1d1d1f]"
            aria-label={`${respostas} respostas recebidas`}
          >
            {respostas}
          </span>{" "}
          resposta{respostas === 1 ? "" : "s"}
        </span>
        {/* Acoes (Publicar/Fechar/Ver respostas) entram na Fase 3.3 */}
        <span className="text-xs text-[#94a3b8]">Fase 3.3</span>
      </footer>
    </article>
  );
}
