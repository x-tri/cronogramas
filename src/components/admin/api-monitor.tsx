import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface ApiUsageEntry {
  readonly id: string;
  readonly created_at: string;
  readonly user_id: string | null;
  readonly endpoint: string | null;
  readonly method: string | null;
  readonly status_code: number | null;
  readonly tokens_in: number;
  readonly tokens_out: number;
  readonly duration_ms: number | null;
  readonly error_message: string | null;
}

interface DailyCallCount {
  readonly date: string;
  readonly count: number;
}

type CallFilter = "all" | "errors";

// ── Helpers ────────────────────────────────────────────────────────────────

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

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly icon: React.ReactNode;
  readonly accent?: string;
}

function KpiCard({ label, value, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col gap-1 relative">
      <div className={`absolute top-4 right-4 ${accent ?? "text-[#94a3b8]"}`}>{icon}</div>
      <span className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{value}</span>
      <span className="text-sm text-[#64748b]">{label}</span>
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

// ── Icons ──────────────────────────────────────────────────────────────────

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

// ── Main Component ─────────────────────────────────────────────────────────

export function ApiMonitor() {
  const [todayEntries, setTodayEntries] = useState<readonly ApiUsageEntry[]>([]);
  const [recentCalls, setRecentCalls] = useState<readonly ApiUsageEntry[]>([]);
  const [chartData, setChartData] = useState<readonly DailyCallCount[]>([]);
  const [callFilter, setCallFilter] = useState<CallFilter>("all");
  const [loading, setLoading] = useState(true);

  // KPI derived values
  const totalCallsToday = todayEntries.length;
  const totalTokens = todayEntries.reduce((sum, e) => sum + (e.tokens_in ?? 0) + (e.tokens_out ?? 0), 0);
  const errorCount = todayEntries.filter(
    (e) => e.status_code !== null && e.status_code >= 400,
  ).length;
  const errorRate = totalCallsToday > 0 ? ((errorCount / totalCallsToday) * 100).toFixed(1) : "0";
  const avgDuration =
    todayEntries.length > 0
      ? Math.round(
          todayEntries.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) / todayEntries.length,
        )
      : 0;

  const loadTodayData = useCallback(async () => {
    const today = startOfDay(0);
    const { data } = await supabase
      .from("api_usage")
      .select("*")
      .gte("created_at", today);
    setTodayEntries((data ?? []) as ApiUsageEntry[]);
  }, []);

  const loadRecentCalls = useCallback(async () => {
    let query = supabase
      .from("api_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (callFilter === "errors") {
      query = query.gte("status_code", 400);
    }

    const { data } = await query;
    setRecentCalls((data ?? []) as ApiUsageEntry[]);
  }, [callFilter]);

  const loadChartData = useCallback(async () => {
    const days: DailyCallCount[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(i);
      const dayEnd = i === 0 ? new Date().toISOString() : startOfDay(i - 1);
      const { count } = await supabase
        .from("api_usage")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString(), count: count ?? 0 });
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
  }, [loadTodayData, loadChartData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecentCalls();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRecentCalls]);

  if (loading) return <LoadingSpinner />;

  const maxChartValue = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Chamadas Hoje" value={formatNumber(totalCallsToday)} icon={<IconBolt />} />
        <KpiCard label="Tokens Usados" value={formatNumber(totalTokens)} icon={<IconChip />} />
        <KpiCard
          label="Taxa de Erro"
          value={`${errorRate}%`}
          icon={<IconExclamation />}
          accent={Number(errorRate) > 5 ? "text-[#dc2626]" : "text-[#94a3b8]"}
        />
        <KpiCard label="Tempo Medio" value={`${avgDuration}ms`} icon={<IconClock />} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
        <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">Chamadas - Ultimos 7 dias</h3>
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

      {/* Recent Calls Table */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb]">
          <h3 className="text-base font-semibold text-[#1d1d1f]">Chamadas Recentes</h3>
          <div className="flex gap-1">
            {(["all", "errors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCallFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  callFilter === f
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#64748b] hover:bg-[#e5e7eb]"
                }`}
              >
                {f === "all" ? "Todas" : "Somente Erros"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f5f5f7]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Tokens (in/out)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Duracao</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748b]">Erro</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#94a3b8]">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                recentCalls.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f5f5f7]/50">
                    <td className="px-4 py-3 whitespace-nowrap" title={formatFullDate(entry.created_at)}>
                      <span className="text-[#1d1d1f]">{relativeTime(entry.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#64748b] text-xs">
                      {entry.user_id ? entry.user_id.slice(0, 8) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge code={entry.status_code} />
                    </td>
                    <td className="px-4 py-3 text-[#64748b] text-xs whitespace-nowrap">
                      <span className="text-[#1d1d1f]">{entry.tokens_in}</span>
                      {" / "}
                      <span className="text-[#1d1d1f]">{entry.tokens_out}</span>
                    </td>
                    <td className="px-4 py-3 text-[#64748b] text-xs">
                      {entry.duration_ms !== null ? `${entry.duration_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                      {entry.error_message ? (
                        <span className="text-[#dc2626]">{entry.error_message}</span>
                      ) : (
                        <span className="text-[#94a3b8]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
