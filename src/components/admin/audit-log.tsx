import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditEntry {
  readonly id: string;
  readonly created_at: string;
  readonly user_name: string | null;
  readonly user_email: string | null;
  readonly action: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly school_id: string | null;
  readonly details: Record<string, unknown> | null;
}

interface School {
  readonly id: string;
  readonly name: string;
}

type PeriodFilter = "today" | "7d" | "30d";

// ── Constants ──────────────────────────────────────────────────────────────

const AUDIT_ACTIONS: readonly string[] = [
  "login",
  "create_cronograma",
  "update_cronograma",
  "delete_cronograma",
  "generate_pdf",
  "add_coordinator",
  "remove_coordinator",
  "create_school",
  "update_school",
  "update_settings",
  "export_data",
];

const ACTION_BADGE_STYLES: Readonly<Record<string, string>> = {
  login: "bg-blue-50 text-[#2563eb]",
  create_cronograma: "bg-green-50 text-[#10b981]",
  generate_pdf: "bg-green-50 text-[#10b981]",
  add_coordinator: "bg-green-50 text-[#10b981]",
  create_school: "bg-green-50 text-[#10b981]",
  delete_cronograma: "bg-red-50 text-[#dc2626]",
  remove_coordinator: "bg-red-50 text-[#dc2626]",
  update_cronograma: "bg-yellow-50 text-[#f59e0b]",
  update_school: "bg-yellow-50 text-[#f59e0b]",
  update_settings: "bg-yellow-50 text-[#f59e0b]",
  export_data: "bg-blue-50 text-[#2563eb]",
};

const ACTION_LABELS: Readonly<Record<string, string>> = {
  login: "Login",
  create_cronograma: "Criar Cronograma",
  update_cronograma: "Atualizar Cronograma",
  delete_cronograma: "Excluir Cronograma",
  generate_pdf: "Gerar PDF",
  add_coordinator: "Adicionar Coordenador",
  remove_coordinator: "Remover Coordenador",
  create_school: "Criar Escola",
  update_school: "Atualizar Escola",
  update_settings: "Configuracoes",
  export_data: "Exportar Dados",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function periodToDate(period: PeriodFilter): string {
  const d = new Date();
  switch (period) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    case "7d":
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    case "30d":
      d.setDate(d.getDate() - 30);
      return d.toISOString();
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg className="animate-spin h-8 w-8 text-[#2563eb]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AuditLog() {
  const [entries, setEntries] = useState<readonly AuditEntry[]>([]);
  const [schools, setSchools] = useState<readonly School[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  // Stats
  const [totalActions, setTotalActions] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [topAction, setTopAction] = useState("");

  const PAGE_SIZE = 50;

  const buildQuery = useCallback(
    (offset: number) => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .gte("created_at", periodToDate(period))
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (schoolFilter) {
        query = query.eq("school_id", schoolFilter);
      }
      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }
      return query;
    },
    [period, schoolFilter, actionFilter],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await buildQuery(0);
    const rows = (data ?? []) as AuditEntry[];
    setEntries(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const { data } = await buildQuery(entries.length);
    const rows = (data ?? []) as AuditEntry[];
    setEntries((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [buildQuery, entries.length]);

  const loadSchools = useCallback(async () => {
    const { data } = await supabase.from("schools").select("id, name").order("name");
    setSchools(data ?? []);
  }, []);

  const computeStats = useCallback(
    (data: readonly AuditEntry[]) => {
      setTotalActions(data.length);
      const users = new Set(data.map((e) => e.user_email).filter(Boolean));
      setUniqueUsers(users.size);

      const counts: Record<string, number> = {};
      for (const entry of data) {
        counts[entry.action] = (counts[entry.action] ?? 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      setTopAction(sorted.length > 0 ? (ACTION_LABELS[sorted[0][0]] ?? sorted[0][0]) : "-");
    },
    [],
  );

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    computeStats(entries);
  }, [entries, computeStats]);

  // Client-side text filter
  const filteredEntries = searchText
    ? entries.filter((e) => {
        const text = searchText.toLowerCase();
        return (
          (e.user_name?.toLowerCase().includes(text) ?? false) ||
          (e.user_email?.toLowerCase().includes(text) ?? false) ||
          (e.entity_id?.toLowerCase().includes(text) ?? false)
        );
      })
    : entries;

  if (loading && entries.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{totalActions}</p>
          <p className="text-xs text-[#64748b]">Acoes no periodo</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{uniqueUsers}</p>
          <p className="text-xs text-[#64748b]">Usuarios unicos</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f] truncate">{topAction}</p>
          <p className="text-xs text-[#64748b]">Acao mais comum</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 flex flex-wrap items-center gap-3">
        {/* Period Toggle */}
        <div className="flex gap-1">
          {(["today", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                period === p
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-[#f5f5f7] text-[#64748b] hover:bg-[#e5e7eb]"
              }`}
            >
              {p === "today" ? "Hoje" : p}
            </button>
          ))}
        </div>

        {/* School Dropdown */}
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-[#e5e7eb] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
        >
          <option value="">Todas as escolas</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Action Dropdown */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-[#e5e7eb] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
        >
          <option value="">Todas as acoes</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a] ?? a}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar usuario, email, entidade..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-[#e5e7eb] bg-white text-[#1d1d1f] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f5f5f7]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Acao</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Entidade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Escola</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#94a3b8]">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const school = schools.find((s) => s.id === entry.school_id);
                  return (
                    <tr key={entry.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f5f5f7]/50">
                      <td className="px-4 py-3 whitespace-nowrap" title={formatFullDate(entry.created_at)}>
                        <span className="text-[#1d1d1f]">{relativeTime(entry.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#1d1d1f] font-medium">{entry.user_name ?? "-"}</span>
                        {entry.user_email && (
                          <span className="block text-xs text-[#94a3b8]">{entry.user_email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-md font-medium ${
                            ACTION_BADGE_STYLES[entry.action] ?? "bg-gray-50 text-[#64748b]"
                          }`}
                        >
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b]">
                        {entry.entity_type && (
                          <span className="text-xs">
                            {entry.entity_type}
                            {entry.entity_id && <span className="text-[#94a3b8]"> #{entry.entity_id.slice(0, 8)}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs">{school?.name ?? "-"}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-xs max-w-[200px] truncate">
                        {entry.details ? JSON.stringify(entry.details) : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && filteredEntries.length > 0 && (
          <div className="p-4 text-center border-t border-[#e5e7eb]">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-xs font-medium text-[#2563eb] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
