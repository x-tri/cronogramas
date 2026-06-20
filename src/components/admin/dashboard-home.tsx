import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
// Leitura cruzada (sem juntar bancos): cronograma/atendimento vem do PRIMARY (supabase),
// alcance/simulado vem do LEGACY de gabaritos via Edge Function autenticada.
// Merge só na exibição, por UUID quando bater e por slug/nome quando os bancos divergirem.
import { coveragePercent, median, normalizeSchoolKey } from "./executive-metrics";
import { SchoolDetailModal } from "./school-detail-modal";

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  readonly escolas_ativas: number;
  readonly alunos_base_escolas_ativas: number;
  readonly alunos_atendidos: number;
  readonly alunos_com_simulado: number;
  readonly alunos_com_cronograma: number;
  readonly cronogramas_gerados: number;
  readonly blocos_criados: number;
  readonly blocos_por_aluno_com_cronograma: number;
  readonly downloads_listas: number;
  readonly storage_objects: number;
  readonly storage_bytes: number;
  readonly cronogramas_today: number;
  readonly cronogramas_week: number;
  readonly mediana_blocos: number | null;
}

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

interface DailyCronograma {
  readonly date: string;
  readonly count: number;
}

interface SchoolHealth {
  readonly school_id: string;
  readonly primary_school_id: string | null;
  readonly name: string;
  readonly alunos_base: number;
  readonly alunos_com_simulado: number;
  readonly alunos_com_cronograma: number;
  readonly alunos_atendidos: number;
  readonly cronogramas_gerados: number;
  readonly blocos_criados: number;
  readonly downloads_listas: number;
  readonly escola_ativa: boolean;
}

interface SchoolActivityRow {
  readonly school_id: string | null;
  readonly escola: string | null;
  readonly slug?: string | null;
  readonly alunos_base?: number | null;
  readonly alunos_com_simulado?: number | null;
  readonly alunos_com_cronograma?: number | null;
  readonly cronogramas_gerados?: number | null;
  readonly blocos_criados?: number | null;
  readonly downloads_listas?: number | null;
  readonly escola_ativa?: boolean | null;
}

interface PrimarySchoolMetrics {
  readonly primary_school_id: string | null;
  readonly cronograma: number;
  readonly cronogramas_gerados: number;
  readonly blocos: number;
}

interface LegacyExecutivePayload {
  readonly metrics: Record<string, unknown> | null;
  readonly storage: Record<string, unknown> | null;
  readonly schools: SchoolActivityRow[];
  readonly source: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Readonly<Record<string, string>> = {
  login: "fez login",
  create_cronograma: "criou cronograma",
  generate_pdf: "gerou PDF",
  add_coordinator: "adicionou coordenador",
  remove_coordinator: "removeu coordenador",
  update_school: "atualizou escola",
  create_school: "criou escola",
  delete_cronograma: "excluiu cronograma",
  update_cronograma: "atualizou cronograma",
  update_settings: "atualizou configuracoes",
  export_data: "exportou dados",
};

const ACTION_COLORS: Readonly<Record<string, string>> = {
  login: "bg-[#2563eb]",
  create_cronograma: "bg-[#10b981]",
  generate_pdf: "bg-[#10b981]",
  add_coordinator: "bg-[#10b981]",
  remove_coordinator: "bg-[#dc2626]",
  delete_cronograma: "bg-[#dc2626]",
  update_school: "bg-[#f59e0b]",
  update_cronograma: "bg-[#f59e0b]",
  update_settings: "bg-[#f59e0b]",
  create_school: "bg-[#10b981]",
  export_data: "bg-[#2563eb]",
};

const DAY_LABELS: readonly string[] = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function startOfDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function emptyDashboardStats(): DashboardStats {
  return {
    escolas_ativas: 0,
    alunos_base_escolas_ativas: 0,
    alunos_atendidos: 0,
    alunos_com_simulado: 0,
    alunos_com_cronograma: 0,
    cronogramas_gerados: 0,
    blocos_criados: 0,
    blocos_por_aluno_com_cronograma: 0,
    downloads_listas: 0,
    storage_objects: 0,
    storage_bytes: 0,
    cronogramas_today: 0,
    cronogramas_week: 0,
    mediana_blocos: null,
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueTextRefs(values: ReadonlyArray<unknown>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function schoolLookupKeys(row: {
  readonly school_id?: unknown;
  readonly escola?: unknown;
  readonly slug?: unknown;
}): string[] {
  const keys: string[] = [];
  if (typeof row.school_id === "string" && row.school_id.trim()) {
    keys.push(`id:${row.school_id.trim()}`);
  }

  for (const value of [row.slug, row.escola]) {
    const normalized = normalizeSchoolKey(value);
    if (normalized) keys.push(`key:${normalized}`);
  }

  return Array.from(new Set(keys));
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

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
}

function KpiCard({ label, value, subtitle, icon }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col gap-1 relative">
      <div className="absolute top-4 right-4 text-[#94a3b8]">{icon}</div>
      <span className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{value}</span>
      <span className="text-sm text-[#64748b]">{label}</span>
      {subtitle && <span className="text-xs text-[#94a3b8]">{subtitle}</span>}
    </div>
  );
}

// ── Icons (inline SVGs) ────────────────────────────────────────────────────

function IconSchool() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}
function IconStudent() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}
function IconDocument() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
function IconStorage() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface DashboardHomeProps {
  userRole?: string | null;
  userSchoolId?: string | null;
}

export function DashboardHome({
  userRole = null,
  userSchoolId = null,
}: DashboardHomeProps) {
  const [stats, setStats] = useState<DashboardStats>(() => emptyDashboardStats());
  const [activities, setActivities] = useState<readonly AuditEntry[]>([]);
  const [activityPeriod, setActivityPeriod] = useState<"24h" | "7d">("24h");
  const [chartData, setChartData] = useState<readonly DailyCronograma[]>([]);
  const [schoolHealth, setSchoolHealth] = useState<readonly SchoolHealth[]>([]);
  const [detailSchool, setDetailSchool] = useState<SchoolHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const isSchoolScoped = userRole !== "super_admin" && Boolean(userSchoolId);

  const loadLegacyExecutiveMetrics = useCallback(async (params: {
    schoolId?: string | null;
    includeSchoolHealth?: boolean;
  }): Promise<LegacyExecutivePayload> => {
    try {
      const { data, error } = await supabase.functions.invoke("get-executive-legacy-metrics", {
        body: {
          school_id: params.schoolId ?? null,
          include_school_health: params.includeSchoolHealth ?? false,
        },
      });

      if (error) {
        console.error("[DashboardHome] Falha ao carregar métricas históricas do LEGACY", error);
        return { metrics: null, storage: null, schools: [], source: "fallback" };
      }

      if (!data || typeof data !== "object") {
        return { metrics: null, storage: null, schools: [], source: "fallback" };
      }

      const payload = data as {
        readonly metrics?: Record<string, unknown> | null;
        readonly storage?: Record<string, unknown> | null;
        readonly schools?: SchoolActivityRow[];
        readonly source?: string;
      };

      return {
        metrics: payload.metrics ?? null,
        storage: payload.storage ?? null,
        schools: Array.isArray(payload.schools) ? payload.schools : [],
        source: payload.source ?? "legacy",
      };
    } catch (error) {
      console.error("[DashboardHome] Falha ao carregar métricas históricas do LEGACY", error);
      return { metrics: null, storage: null, schools: [], source: "fallback" };
    }
  }, []);

  const loadScopedStudentRefs = useCallback(async (): Promise<string[]> => {
    if (!userSchoolId) {
      return [];
    }

    const { data } = await supabase
      .from("students")
      .select("id, matricula")
      .eq("school_id", userSchoolId);

    return uniqueTextRefs((data ?? []).flatMap((student) => [student.id, student.matricula]));
  }, [userSchoolId]);

  const countScopedCronogramas = useCallback(async (params?: {
    studentRefs?: string[];
    since?: string;
    until?: string;
    dateColumn?: "created_at" | "updated_at";
  }): Promise<number> => {
    const studentRefs = params?.studentRefs ?? [];
    const dateColumn = params?.dateColumn ?? "updated_at";

    if (studentRefs.length === 0) {
      return 0;
    }

    let query = supabase
      .from("cronogramas")
      .select("id", { count: "exact", head: true })
      .in("aluno_id", studentRefs);

    if (params?.since) {
      query = query.gte(dateColumn, params.since);
    }

    if (params?.until) {
      query = query.lt(dateColumn, params.until);
    }

    const { count } = await query;
    return count ?? 0;
  }, []);

  const loadStats = useCallback(async () => {
    // PRIMARY = produção real (cronograma, blocos). LEGACY = alcance (simulado, base, downloads).
    const scopedStudentRefs =
      isSchoolScoped && userSchoolId ? await loadScopedStudentRefs() : [];

    const primaryQuery =
      isSchoolScoped && userSchoolId
        ? supabase
            .rpc("get_executive_school_activity", {
              p_school_id: userSchoolId,
              p_only_active: false,
            })
            .maybeSingle()
        : supabase.rpc("get_executive_operation_metrics").maybeSingle();
    const legacyQuery = loadLegacyExecutiveMetrics({
      schoolId: isSchoolScoped && userSchoolId ? userSchoolId : null,
      includeSchoolHealth: false,
    });

    const [primaryRes, legacyPayload, primaryStorageRes, blocosDistRes] = await Promise.all([
      primaryQuery,
      legacyQuery,
      supabase.rpc("get_executive_storage_metrics").maybeSingle(),
      // Mediana global sem expor aluno_id; o RPC valida super_admin no banco.
      isSchoolScoped
        ? Promise.resolve({ data: null, error: null })
        : supabase.rpc("get_executive_blocos_distribution"),
    ]);

    const countGlobalCronogramas = async (since: string, label: string): Promise<number> => {
      const { count, error } = await supabase
        .from("cronogramas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);

      if (error) {
        console.error(`[DashboardHome] Falha ao contar cronogramas ${label}`, error);
      }

      return count ?? 0;
    };

    const [cronogramasToday, cronogramasWeek] = await Promise.all([
      isSchoolScoped
        ? countScopedCronogramas({
            studentRefs: scopedStudentRefs,
            since: startOfDay(0),
            dateColumn: "created_at",
          })
        : countGlobalCronogramas(startOfDay(0), "de hoje"),
      isSchoolScoped
        ? countScopedCronogramas({
            studentRefs: scopedStudentRefs,
            since: startOfDay(7),
            dateColumn: "created_at",
          })
        : countGlobalCronogramas(startOfDay(7), "da semana"),
    ]);

    if (primaryRes.error) {
      console.error("[DashboardHome] Falha ao carregar métricas de cronograma (PRIMARY)", primaryRes.error);
    }
    if (primaryStorageRes.error) {
      console.error("[DashboardHome] Falha ao carregar storage do PRIMARY", primaryStorageRes.error);
    }
    if (blocosDistRes.error) {
      console.error("[DashboardHome] Falha ao carregar distribuição de blocos", blocosDistRes.error);
    }

    const primary = primaryRes.data as Record<string, unknown> | null; // cronograma (PRIMARY)
    const legacy = legacyPayload.metrics ?? primary; // simulado/alcance (LEGACY; PRIMARY só fallback)
    const storage = legacyPayload.storage;
    const primaryStorage = primaryStorageRes.data as Record<string, unknown> | null;
    const blocosPorAluno = ((blocosDistRes.data ?? []) as Array<{ blocos: number }>).map(
      (row) => row.blocos,
    );

    const alunosComCronograma = toNumber(primary?.alunos_com_cronograma);
    const blocosCriados = toNumber(primary?.blocos_criados);

    setStats({
      escolas_ativas: isSchoolScoped
        ? (legacy?.escola_ativa || alunosComCronograma > 0 ? 1 : 0)
        : toNumber(legacy?.escolas_ativas),
      alunos_base_escolas_ativas: toNumber(legacy?.alunos_base_escolas_ativas ?? legacy?.alunos_base),
      alunos_atendidos: alunosComCronograma, // atendido = aluno com cronograma gerado (PRIMARY)
      alunos_com_simulado: toNumber(legacy?.alunos_com_simulado), // alcance (LEGACY)
      alunos_com_cronograma: alunosComCronograma,
      cronogramas_gerados: toNumber(primary?.cronogramas_gerados),
      blocos_criados: blocosCriados,
      blocos_por_aluno_com_cronograma: toNumber(
        primary?.blocos_por_aluno_com_cronograma ??
          (alunosComCronograma > 0 ? blocosCriados / alunosComCronograma : 0),
      ),
      downloads_listas: toNumber(legacy?.downloads_listas),
      // storage = banco atual + histórico (antes o card só via o histórico)
      storage_objects: toNumber(storage?.storage_objects) + toNumber(primaryStorage?.storage_objects),
      storage_bytes: toNumber(storage?.storage_bytes) + toNumber(primaryStorage?.storage_bytes),
      mediana_blocos: median(blocosPorAluno),
      cronogramas_today: cronogramasToday,
      cronogramas_week: cronogramasWeek,
    });
  }, [
    countScopedCronogramas,
    isSchoolScoped,
    loadLegacyExecutiveMetrics,
    loadScopedStudentRefs,
    userSchoolId,
  ]);

  const loadActivities = useCallback(async () => {
    const since = activityPeriod === "24h" ? startOfDay(1) : startOfDay(7);
    let query = supabase
      .from("audit_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);

    if (isSchoolScoped && userSchoolId) {
      query = query.eq("school_id", userSchoolId);
    }

    const { data } = await query;
    setActivities(data ?? []);
  }, [activityPeriod, isSchoolScoped, userSchoolId]);

  const loadChartData = useCallback(async () => {
    const scopedStudentRefs =
      isSchoolScoped && userSchoolId ? await loadScopedStudentRefs() : [];

    const days: DailyCronograma[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(i);
      const dayEnd = i === 0 ? new Date().toISOString() : startOfDay(i - 1);

      const count =
        isSchoolScoped && userSchoolId
          ? await countScopedCronogramas({
              studentRefs: scopedStudentRefs,
              since: dayStart,
              until: dayEnd,
            })
          : (
              await supabase
                .from("cronogramas")
                .select("id", { count: "exact" })
                .gte("updated_at", dayStart)
                .lt("updated_at", dayEnd)
                .limit(1)
            ).count ?? 0;

      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString(), count });
    }
    setChartData(days);
  }, [countScopedCronogramas, isSchoolScoped, loadScopedStudentRefs, userSchoolId]);

  const loadSchoolHealth = useCallback(async () => {
    // LEGACY: alcance por escola (base, simulado, downloads, nome) — mantém TODAS as escolas
    // que fizeram simulado, mesmo sem cronograma. PRIMARY: cronograma/blocos reais, sobrepostos.
    const legacyQuery = loadLegacyExecutiveMetrics({
      schoolId: isSchoolScoped && userSchoolId ? userSchoolId : null,
      includeSchoolHealth: true,
    });
    const primaryQuery = supabase.rpc("get_executive_school_activity", {
      p_school_id: isSchoolScoped && userSchoolId ? userSchoolId : null,
      p_only_active: false,
    });

    const [legacyPayload, primaryRes] = await Promise.all([legacyQuery, primaryQuery]);

    if (primaryRes.error) {
      console.error("[DashboardHome] Falha ao carregar cronograma das escolas (PRIMARY)", primaryRes.error);
    }

    const primaryRows = (primaryRes.data ?? []) as SchoolActivityRow[];
    const cronogramaBySchool = new Map<string, PrimarySchoolMetrics>();
    for (const row of primaryRows) {
      const metric: PrimarySchoolMetrics = {
        primary_school_id: typeof row.school_id === "string" ? row.school_id : null,
        cronograma: toNumber(row.alunos_com_cronograma),
        cronogramas_gerados: toNumber(row.cronogramas_gerados),
        blocos: toNumber(row.blocos_criados),
      };

      for (const key of schoolLookupKeys(row)) {
        if (!cronogramaBySchool.has(key)) {
          cronogramaBySchool.set(key, metric);
        }
      }
    }

    const legacyRows = legacyPayload.schools.length > 0 ? legacyPayload.schools : primaryRows;
    const merged: SchoolHealth[] = legacyRows
      .filter((school) => !/^teste/i.test(String(school.escola ?? "").trim()))
      .map((school) => {
        const cron = schoolLookupKeys(school)
          .map((key) => cronogramaBySchool.get(key))
          .find((value): value is PrimarySchoolMetrics => Boolean(value)) ?? {
            primary_school_id: null,
            cronograma: 0,
            cronogramas_gerados: 0,
            blocos: 0,
          };

        return {
          school_id: String(school.school_id ?? school.slug ?? school.escola),
          primary_school_id: cron.primary_school_id,
          name: String(school.escola ?? "Escola sem nome"),
          alunos_base: toNumber(school.alunos_base),
          alunos_com_simulado: toNumber(school.alunos_com_simulado),
          alunos_com_cronograma: cron.cronograma,
          alunos_atendidos: cron.cronograma, // atendido = cronograma (PRIMARY), não simulado
          cronogramas_gerados: cron.cronogramas_gerados,
          blocos_criados: cron.blocos,
          downloads_listas: toNumber(school.downloads_listas),
          escola_ativa: Boolean(school.escola_ativa),
        };
      });

    // Atendimento (cronograma) primeiro; depois alcance (simulado).
    merged.sort(
      (a, b) =>
        b.alunos_atendidos - a.alunos_atendidos ||
        b.alunos_com_simulado - a.alunos_com_simulado,
    );

    setSchoolHealth(merged);
  }, [isSchoolScoped, loadLegacyExecutiveMetrics, userSchoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        await Promise.all([loadStats(), loadChartData(), loadSchoolHealth()]);
        setLoading(false);
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadStats, loadChartData, loadSchoolHealth]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActivities();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadActivities]);

  if (loading) return <LoadingSpinner />;

  const maxChartValue = Math.max(...chartData.map((d) => d.count), 1);

  // Backlog: escolas que fizeram simulado mas ainda não têm nenhum cronograma gerado.
  const backlogSchools = schoolHealth.filter(
    (s) => s.alunos_com_simulado > 0 && s.alunos_atendidos === 0,
  );
  const backlogAlunos = backlogSchools.reduce((sum, s) => sum + s.alunos_com_simulado, 0);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
          Visão Executiva
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#1d1d1f]">
          O que foi produzido na operação e como cada escola está rodando
        </h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Atendimento = aluno com cronograma de estudo gerado (produção real). "Fizeram simulado"
          é o alcance — quem fez a prova, mesmo sem plano ainda. Cobertura = atendidos / base.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8] mb-3">
            Produção da operação
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Alunos atendidos"
              value={stats.alunos_atendidos}
              subtitle={`${
                coveragePercent(stats.alunos_atendidos, stats.alunos_base_escolas_ativas)
                  ? `cobertura: ${coveragePercent(stats.alunos_atendidos, stats.alunos_base_escolas_ativas)} da base • `
                  : ""
              }${stats.alunos_com_simulado} fizeram simulado (inclui histórico)`}
              icon={<IconStudent />}
            />
            <KpiCard
              label="Cronogramas gerados"
              value={stats.cronogramas_gerados}
              subtitle={`total desde o início • ${stats.cronogramas_today} hoje / ${stats.cronogramas_week} esta semana`}
              icon={<IconCalendar />}
            />
            <KpiCard
              label="Blocos criados"
              value={stats.blocos_criados}
              subtitle={
                stats.mediana_blocos != null
                  ? `mediana: ${stats.mediana_blocos} por aluno (média ${stats.blocos_por_aluno_com_cronograma})`
                  : `${stats.blocos_por_aluno_com_cronograma} blocos por aluno com cronograma`
              }
              icon={<IconCalendar />}
            />
            <KpiCard
              label="Downloads/listas"
              value={stats.downloads_listas}
              subtitle="Entregas dos alunos • inclui histórico 2024-25"
              icon={<IconDocument />}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8] mb-3">
            Base da plataforma
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={isSchoolScoped ? "Sua escola" : "Escolas"}
              value={stats.escolas_ativas}
              icon={<IconSchool />}
            />
            <KpiCard
              label="Alunos na base ativa"
              value={stats.alunos_base_escolas_ativas}
              subtitle="base de alcance (banco histórico)"
              icon={<IconUsers />}
            />
            <KpiCard
              label="Objetos no storage"
              value={stats.storage_objects}
              subtitle="banco atual + histórico"
              icon={<IconStorage />}
            />
            <KpiCard
              label="Armazenamento"
              value={formatBytes(stats.storage_bytes)}
              subtitle="banco atual + histórico"
              icon={<IconStorage />}
            />
          </div>
        </div>
      </div>

      {/* Activity Feed + Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1d1d1f]">Atividade Recente</h3>
            <div className="flex gap-1">
              {(["24h", "7d"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setActivityPeriod(period)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    activityPeriod === period
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-[#f5f5f7] text-[#64748b] hover:bg-[#e5e7eb]"
                  }`}
                >
                  {period === "24h" ? "24h" : "7 dias"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm text-[#94a3b8] text-center py-8">Nenhuma atividade no periodo</p>
            ) : (
              activities.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTION_COLORS[entry.action] ?? "bg-[#94a3b8]"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#1d1d1f] truncate">
                      <span className="font-medium">{entry.user_name ?? entry.user_email ?? "Sistema"}</span>{" "}
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="text-xs text-[#94a3b8]">{relativeTime(entry.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cronogramas Chart */}
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
          <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">Cronogramas - Ultimos 7 dias</h3>
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
      </div>

      {/* School Health Grid */}
      <div>
        <h3 className="text-base font-semibold text-[#1d1d1f] mb-4">
          {isSchoolScoped ? "Saúde da sua escola" : "Saude das Escolas"}
        </h3>
        {schoolHealth.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">Nenhuma escola cadastrada</p>
        ) : (
          <>
            {backlogSchools.length > 0 && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-4 py-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#dc2626]" />
                <p className="text-sm text-[#92400e]">
                  <span className="font-semibold">{backlogSchools.length} escolas</span>
                  {" • "}
                  <span className="font-semibold">{backlogAlunos} alunos</span> fizeram simulado e
                  ainda não têm cronograma gerado — fila de plano a produzir.
                </p>
              </div>
            )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schoolHealth.map((school) => {
              const coverage = school.alunos_base > 0 ? Math.round((school.alunos_atendidos / school.alunos_base) * 100) : 0;
              const dotColor = coverage >= 80 ? "bg-[#10b981]" : coverage >= 40 ? "bg-[#f59e0b]" : "bg-[#dc2626]";
              const isBacklog = school.alunos_com_simulado > 0 && school.alunos_atendidos === 0;

              return (
                <button
                  key={school.school_id}
                  type="button"
                  onClick={() => setDetailSchool(school)}
                  title={`Ver detalhes de ${school.name}`}
                  className={`rounded-2xl border p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] ${
                    isBacklog ? "border-[#fcd34d] bg-[#fffdf5]" : "border-[#e5e7eb] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <h4 className="text-sm font-semibold text-[#1d1d1f] truncate">{school.name}</h4>
                    {isBacklog && (
                      <span className="ml-auto shrink-0 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400e]">
                        sem plano
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#64748b]">
                    <span>{school.alunos_atendidos}/{school.alunos_base} atendidos</span>
                    <span>{coverage}% cobertura</span>
                    <span>{school.alunos_com_simulado} fizeram simulado</span>
                    <span>{school.blocos_criados} blocos</span>
                  </div>
                </button>
              );
            })}
          </div>
          </>
        )}
      </div>

      {detailSchool && (
        <SchoolDetailModal school={detailSchool} onClose={() => setDetailSchool(null)} />
      )}
    </div>
  );
}
