import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface ApiUsageEntry {
  readonly id: string;
  readonly created_at: string;
  readonly user_id: string | null;
  readonly endpoint: string | null;
  readonly model: string | null;
  readonly status: number | null;
  readonly tokens_in: number;
  readonly tokens_out: number;
  readonly duration_ms: number | null;
  readonly error: string | null;
}

interface DailyCallCount {
  readonly date: string;
  readonly count: number;
}

type CallFilter = "all" | "errors";

function startOfDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
    second: "2-digit",
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const DAY_LABELS: readonly string[] = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly accent?: string;
}

function KpiCard({ label, value, subtitle, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col gap-1 relative">
      <div className={`absolute top-4 right-4 ${accent ?? "text-[#94a3b8]"}`}>{icon}</div>
      <span className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{value}</span>
      <span className="text-sm text-[#64748b]">{label}</span>
      {subtitle ? <span className="text-xs text-[#94a3b8]">{subtitle}</span> : null}
    </div>
  );
}

function StatusBadge({ code }: { readonly code: number | null }) {
  if (code === null) return <span className="text-[#94a3b8]">-</span>;

  const isSuccess = code >= 200 && code < 300;
  const isClientError = code >= 400 && code < 500;
  const isServerError = code >= 500;

  let style = "bg-green-50 text-[#10b981]";
  if (isClientError) style = "bg-yellow-50 text-[#f59e0b]";
  if (isServerError) style = "bg-red-50 text-[#dc2626]";
  if (!isSuccess && !isClientError && !isServerError) style = "bg-gray-50 text-[#64748b]";

  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-md font-medium ${style}`}>
      {code}
    </span>
  );
}

function IconBolt() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

function IconChip() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function IconExclamation() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

type UserLabelMap = Record<string, string>;

export function ApiMonitor() {
  const [todayEntries, setTodayEntries] = useState<readonly ApiUsageEntry[]>([]);
  const [recentCalls, setRecentCalls] = useState<readonly ApiUsageEntry[]>([]);
  const [chartData, setChartData] = useState<readonly DailyCallCount[]>([]);
  const [userLabels, setUserLabels] = useState<UserLabelMap>({});
  const [callFilter, setCallFilter] = useState<CallFilter>("all");
  const [loading, setLoading] = useState(true);

  const totalCallsToday = todayEntries.length;
  const totalTokens = todayEntries.reduce(
    (sum, entry) => sum + (entry.tokens_in ?? 0) + (entry.tokens_out ?? 0),
    0,
  );
  const errorCount = todayEntries.filter((entry) => {
    return Boolean((entry.status !== null && entry.status >= 400) || entry.error);
  }).length;
  const avgDuration =
    todayEntries.length > 0
      ? Math.round(
          todayEntries.reduce((sum, entry) => sum + (entry.duration_ms ?? 0), 0) /
            todayEntries.length,
        )
      : 0;
  const recentModels = Array.from(
    new Set(recentCalls.map((entry) => entry.model).filter(Boolean)),
  ) as string[];

  const loadUserLabels = useCallback(async (entries: readonly ApiUsageEntry[]) => {
    const unresolvedIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.user_id)
          .filter(
            (userId): userId is string =>
              typeof userId === "string" &&
              userId.length > 0 &&
              userLabels[userId] === undefined,
          ),
      ),
    );

    if (unresolvedIds.length === 0) {
      return;
    }

    const { data } = await supabase
      .from("project_users")
      .select("auth_uid, name, email")
      .in("auth_uid", unresolvedIds);

    if (!data) {
      return;
    }

    setUserLabels((current) => {
      const next = { ...current };
      for (const row of data) {
        next[row.auth_uid] = row.name ?? row.email ?? row.auth_uid.slice(0, 8);
      }
      return next;
    });
  }, [userLabels]);

  const loadTodayData = useCallback(async () => {
    const today = startOfDay(0);
    const { data } = await supabase
      .from("api_usage")
      .select("*")
      .gte("created_at", today);

    const entries = (data ?? []) as ApiUsageEntry[];
    setTodayEntries(entries);
    await loadUserLabels(entries);
  }, [loadUserLabels]);

  const loadRecentCalls = useCallback(async () => {
    let query = supabase
      .from("api_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (callFilter === "errors") {
      query = query.or("status.gte.400,error.not.is.null");
    }

    const { data } = await query;
    const entries = (data ?? []) as ApiUsageEntry[];
    setRecentCalls(entries);
    await loadUserLabels(entries);
  }, [callFilter, loadUserLabels]);

  const loadChartData = useCallback(async () => {
    const days: DailyCallCount[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(i);
      const dayEnd = i === 0 ? new Date().toISOString() : startOfDay(i - 1);
      const { count } = await supabase
        .from("api_usage")
        .select("id", { count: "exact" })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString(),
        count: count ?? 0,
      });
    }

    setChartData(days);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        await Promise.all([loadTodayData(), loadChartData()]);
        setLoading(false);
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadChartData, loadTodayData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecentCalls();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRecentCalls]);

  if (loading) {
    return <LoadingSpinner />;
  }

  const maxChartValue = Math.max(...chartData.map((entry) => entry.count), 1);
  const lastCall = recentCalls[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
          Operação de API e IA
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#1d1d1f]">
          O que está acontecendo no motor de IA
        </h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Esta tela acompanha chamadas de IA reais, modelos usados, latência e falhas.
          Ela serve para entender se o motor está operando, em qual volume e com qual
          qualidade.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#64748b]">
          <span className="rounded-full bg-[#f8fafc] px-3 py-1">
            {recentModels.length > 0
              ? `${recentModels.length} modelo(s) ativo(s): ${recentModels.join(", ")}`
              : "Nenhum modelo ativo no recorte recente"}
          </span>
          {lastCall ? (
            <span className="rounded-full bg-[#f8fafc] px-3 py-1">
              Última chamada em {relativeTime(lastCall.created_at)} via{" "}
              <strong className="font-medium text-[#1d1d1f]">{lastCall.endpoint ?? "endpoint não informado"}</strong>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Chamadas hoje" value={formatNumber(totalCallsToday)} icon={<IconBolt />} />
        <KpiCard label="Tokens hoje" value={formatNumber(totalTokens)} icon={<IconChip />} />
        <KpiCard
          label="Falhas hoje"
          value={formatNumber(errorCount)}
          subtitle={totalCallsToday > 0 ? `${((errorCount / totalCallsToday) * 100).toFixed(1)}% do volume de hoje` : "Sem chamadas hoje"}
          icon={<IconExclamation />}
          accent={errorCount > 0 ? "text-[#dc2626]" : "text-[#94a3b8]"}
        />
        <KpiCard
          label="Latência média"
          value={`${avgDuration}ms`}
          subtitle={totalCallsToday > 0 ? "Média das chamadas de hoje" : "Sem base hoje"}
          icon={<IconClock />}
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
        <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">Chamadas nos últimos 7 dias</h3>
        <div className="flex items-end gap-2 h-48">
          {chartData.map((day) => {
            const d = new Date(day.date);
            const heightPercent = maxChartValue > 0 ? (day.count / maxChartValue) * 100 : 0;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[#64748b] font-medium">{day.count}</span>
                <div className="w-full flex items-end" style={{ height: "140px" }}>
                  <div
                    className="w-full bg-[#2563eb] rounded-t-lg transition-all duration-300"
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                  />
                </div>
                <span className="text-xs text-[#94a3b8]">{DAY_LABELS[d.getDay()]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb]">
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">Chamadas recentes</h3>
            <p className="text-xs text-[#94a3b8] mt-1">
              Aqui entra o detalhe operacional: endpoint, modelo, usuário, status e erro.
            </p>
          </div>
          <div className="flex gap-1">
            {(["all", "errors"] as const).map((filterValue) => (
              <button
                key={filterValue}
                onClick={() => setCallFilter(filterValue)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  callFilter === filterValue
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#64748b] hover:bg-[#e5e7eb]"
                }`}
              >
                {filterValue === "all" ? "Todas" : "Somente erros"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f5f5f7]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Operação</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Modelo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Tokens</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Duração</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Erro</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#94a3b8]">
                    Nenhuma chamada encontrada no filtro atual.
                  </td>
                </tr>
              ) : (
                recentCalls.map((entry) => {
                  const resolvedUser =
                    (entry.user_id ? userLabels[entry.user_id] : null) ??
                    (entry.user_id ? entry.user_id.slice(0, 8) : "Sistema");

                  return (
                    <tr key={entry.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f5f5f7]/50">
                      <td className="px-4 py-3 whitespace-nowrap" title={formatFullDate(entry.created_at)}>
                        <span className="text-[#1d1d1f]">{relativeTime(entry.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#1d1d1f] whitespace-nowrap">
                        {entry.endpoint ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                        {entry.model ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                        {resolvedUser}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge code={entry.status} />
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs whitespace-nowrap">
                        <span className="text-[#1d1d1f]">{entry.tokens_in}</span>
                        {" / "}
                        <span className="text-[#1d1d1f]">{entry.tokens_out}</span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b] text-xs whitespace-nowrap">
                        {entry.duration_ms !== null ? `${entry.duration_ms}ms` : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[280px] truncate" title={entry.error ?? undefined}>
                        {entry.error ? (
                          <span className="text-[#dc2626]">{entry.error}</span>
                        ) : (
                          <span className="text-[#94a3b8]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
