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
import { ConfirmDialog } from "./simulado-actions/confirm-dialog";
import { SimuladoRanking } from "./simulado-actions/simulado-ranking";
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
  readonly caderno_url: string | null;
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

  // Fase 3.3: acoes nos cards.
  type PendingAction =
    | { readonly kind: "publish"; readonly simulado: SimuladoRow }
    | { readonly kind: "close"; readonly simulado: SimuladoRow }
    | { readonly kind: "delete"; readonly simulado: SimuladoRow };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drawerSimulado, setDrawerSimulado] = useState<SimuladoRow | null>(null);

  // Estado do dialog de edição de link do caderno
  const [editLinkSimulado, setEditLinkSimulado] = useState<SimuladoRow | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState<string>("");
  const [editLinkSaving, setEditLinkSaving] = useState<boolean>(false);
  const [editLinkError, setEditLinkError] = useState<string | null>(null);

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
        "id, title, school_id, turmas, status, published_at, created_at, caderno_url, simulado_respostas(count)",
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

  const openEditLink = (sim: SimuladoRow): void => {
    setEditLinkSimulado(sim);
    setEditLinkUrl(sim.caderno_url ?? "");
    setEditLinkError(null);
  };

  const closeEditLink = (): void => {
    setEditLinkSimulado(null);
    setEditLinkUrl("");
    setEditLinkSaving(false);
    setEditLinkError(null);
  };

  const saveEditLink = async (): Promise<void> => {
    if (!editLinkSimulado) return;
    setEditLinkSaving(true);
    setEditLinkError(null);
    const { error: e } = await supabase
      .from("simulados")
      .update({ caderno_url: editLinkUrl.trim() || null })
      .eq("id", editLinkSimulado.id);
    if (e) {
      setEditLinkSaving(false);
      setEditLinkError(e.message);
      return;
    }
    closeEditLink();
    setReloadTick((n) => n + 1);
  };

  const closePendingAction = (): void => {
    setPendingAction(null);
    setActionError(null);
    setActionLoading(false);
  };

  const runAction = async (action: PendingAction): Promise<void> => {
    setActionLoading(true);
    setActionError(null);

    const simId = action.simulado.id;
    let queryError: { message: string } | null = null;

    if (action.kind === "publish") {
      const { error: e } = await supabase
        .from("simulados")
        .update({ status: "published" })
        .eq("id", simId);
      queryError = e;
    } else if (action.kind === "close") {
      const { error: e } = await supabase
        .from("simulados")
        .update({ status: "closed" })
        .eq("id", simId);
      queryError = e;
    } else if (action.kind === "delete") {
      const { error: e } = await supabase
        .from("simulados")
        .delete()
        .eq("id", simId);
      queryError = e;
    }

    if (queryError) {
      setActionLoading(false);
      setActionError(queryError.message);
      return;
    }

    closePendingAction();
    setReloadTick((n) => n + 1);
  };

  const schoolNameById = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const s of schools) m[s.id] = s.name;
    return m;
  }, [schools]);

  // Estabiliza referencia do array pra evitar re-fetch redundante dentro do
  // SimuladoRanking — sem isso, `drawerSimulado?.turmas ?? []` gera novo array
  // a cada render e dispara useEffect desnecessariamente.
  const rankingTurmas = useMemo<ReadonlyArray<string>>(
    () => drawerSimulado?.turmas ?? [],
    [drawerSimulado?.id],
  );

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
                onPublish={() =>
                  setPendingAction({ kind: "publish", simulado: sim })
                }
                onClose={() =>
                  setPendingAction({ kind: "close", simulado: sim })
                }
                onDelete={() =>
                  setPendingAction({ kind: "delete", simulado: sim })
                }
                onViewResponses={() => setDrawerSimulado(sim)}
                onEditLink={() => openEditLink(sim)}
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "publish"
            ? "Publicar simulado?"
            : pendingAction?.kind === "close"
              ? "Encerrar simulado?"
              : "Excluir simulado?"
        }
        message={
          pendingAction?.kind === "publish"
            ? `"${pendingAction.simulado.title}" sera visivel aos alunos para responderem. Publicar um simulado exige que os 180 itens estejam cadastrados (45 por area).`
            : pendingAction?.kind === "close"
              ? `"${pendingAction.simulado.title}" deixara de aceitar novas respostas. Dados ja recebidos continuam disponiveis para consulta.`
              : pendingAction?.kind === "delete"
                ? `"${pendingAction.simulado.title}" sera APAGADO permanentemente junto com todas as respostas recebidas. Esta acao nao pode ser desfeita.`
                : ""
        }
        confirmLabel={
          pendingAction?.kind === "publish"
            ? "Publicar"
            : pendingAction?.kind === "close"
              ? "Encerrar"
              : "Excluir definitivamente"
        }
        tone={pendingAction?.kind === "delete" ? "danger" : "default"}
        loading={actionLoading}
        errorMessage={actionError}
        onConfirm={() => {
          if (pendingAction) void runAction(pendingAction);
        }}
        onCancel={closePendingAction}
      />

      <SimuladoRanking
        open={drawerSimulado !== null}
        simuladoId={drawerSimulado?.id ?? null}
        simuladoTitle={drawerSimulado?.title ?? ""}
        schoolId={drawerSimulado?.school_id ?? null}
        turmasAlvo={rankingTurmas}
        onClose={() => setDrawerSimulado(null)}
      />

      {/* Dialog: editar link do caderno */}
      {editLinkSimulado !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar link do caderno"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">
              Link do caderno
            </h2>
            <p className="text-xs text-[#71717a] mb-4">
              <span className="font-medium text-[#1d1d1f]">{editLinkSimulado.title}</span>
              {" "}— Cole o link do Google Drive ou deixe vazio para remover.
            </p>
            <input
              type="url"
              value={editLinkUrl}
              onChange={(e) => setEditLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              autoFocus
              className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none mb-3"
            />
            {editLinkError && (
              <p role="alert" className="mb-3 text-xs text-[#dc2626]">
                {editLinkError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditLink}
                disabled={editLinkSaving}
                className="text-sm font-medium text-[#71717a] hover:text-[#1d1d1f] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { void saveEditLink(); }}
                disabled={editLinkSaving}
                className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:bg-[#e5e7eb] disabled:text-[#94a3b8]"
              >
                {editLinkSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  readonly onPublish: () => void;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onViewResponses: () => void;
  readonly onEditLink: () => void;
}

function SimuladoCard({
  simulado,
  schoolName,
  onPublish,
  onClose,
  onDelete,
  onViewResponses,
  onEditLink,
}: SimuladoCardProps) {
  const style = STATUS_STYLES[simulado.status];
  const respostas = countRespostas(simulado);
  const turmasLabel =
    simulado.turmas.length === 0
      ? "Todas as turmas"
      : simulado.turmas.join(", ");

  const isDraft = simulado.status === "draft";
  const isPublished = simulado.status === "published";

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
        {simulado.caderno_url && (
          <div className="flex items-center gap-2">
            <dt className="font-medium">Caderno:</dt>
            <dd>
              <a
                href={simulado.caderno_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563eb] hover:underline truncate max-w-[160px] inline-block align-bottom"
                title={simulado.caderno_url}
              >
                🔗 Ver link
              </a>
            </dd>
          </div>
        )}
      </dl>

      <footer className="mt-4 flex flex-col gap-2 border-t border-[#f4f4f5] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#71717a]">
            <span
              className="font-semibold text-[#1d1d1f]"
              aria-label={`${respostas} respostas recebidas`}
            >
              {respostas}
            </span>{" "}
            resposta{respostas === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEditLink}
              className="text-xs font-medium text-[#71717a] hover:text-[#2563eb] hover:underline"
              aria-label={`Editar link do caderno de ${simulado.title}`}
              title={simulado.caderno_url ? "Editar link do caderno" : "Adicionar link do caderno"}
            >
              {simulado.caderno_url ? "🔗 Editar link" : "🔗 Adicionar link"}
            </button>
            <button
              type="button"
              onClick={onViewResponses}
              className="text-xs font-medium text-[#2563eb] hover:underline"
              aria-label={`Ver respostas de ${simulado.title}`}
            >
              Ver respostas
            </button>
          </div>
        </div>

        {/* Botoes de estado */}
        <div className="flex items-center gap-2">
          {isDraft && (
            <button
              type="button"
              onClick={onPublish}
              className="flex-1 rounded-md bg-[#16a34a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#15803d]"
              aria-label={`Publicar ${simulado.title}`}
            >
              Publicar
            </button>
          )}
          {isPublished && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-xs font-medium text-[#9a3412] hover:bg-[#ffedd5]"
              aria-label={`Encerrar ${simulado.title}`}
            >
              Encerrar
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-[#fecaca] px-2.5 py-1.5 text-xs font-medium text-[#dc2626] hover:bg-[#fef2f2]"
            aria-label={`Excluir ${simulado.title}`}
            title="Excluir simulado"
          >
            Excluir
          </button>
        </div>
      </footer>
    </article>
  );
}
