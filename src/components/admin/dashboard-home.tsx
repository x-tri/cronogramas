import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { simuladoSupabase } from "../../lib/simulado-supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  readonly total_schools: number;
  readonly total_coordinators: number;
  readonly total_students: number;
  readonly students_with_cronograma: number;
  readonly total_cronogramas: number;
  readonly total_blocos: number;
  readonly media_blocos_por_aluno: number;
  readonly total_pdfs: number;
  readonly storage_bytes: number;
  readonly cronogramas_today: number;
  readonly cronogramas_week: number;
  readonly api_calls_today: number;
  readonly api_errors_today: number;
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
  readonly id: string;
  readonly name: string;
  readonly coordinator_count: number;
  readonly cronogramas_week: number;
  readonly last_activity: string | null;
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
  const [renderTimestamp] = useState(() => Date.now());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<readonly AuditEntry[]>([]);
  const [activityPeriod, setActivityPeriod] = useState<"24h" | "7d">("24h");
  const [chartData, setChartData] = useState<readonly DailyCronograma[]>([]);
  const [schoolHealth, setSchoolHealth] = useState<readonly SchoolHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const isSchoolScoped = userRole !== "super_admin" && Boolean(userSchoolId);

  const loadScopedStudentIds = useCallback(async (): Promise<string[]> => {
    if (!userSchoolId) {
      return [];
    }

    const [primaryRes, simuladoRes] = await Promise.all([
      supabase
        .from("students")
        .select("matricula")
        .eq("school_id", userSchoolId),
      simuladoSupabase
        .from("students")
        .select("matricula")
        .eq("school_id", userSchoolId),
    ]);

    return [...(primaryRes.data ?? []), ...(simuladoRes.data ?? [])]
      .map((student) => student.matricula)
      .filter(
        (matricula): matricula is string =>
          typeof matricula === "string" && matricula.trim().length > 0,
      );
  }, [userSchoolId]);

  const countScopedCronogramas = useCallback(async (params?: {
    studentIds?: string[];
    since?: string;
    until?: string;
  }): Promise<number> => {
    const studentIds = params?.studentIds ?? [];

    if (studentIds.length === 0) {
      return 0;
    }

    let query = supabase
      .from("cronogramas")
      .select("id", { count: "exact" })
      .in("aluno_id", studentIds);

    if (params?.since) {
      query = query.gte("updated_at", params.since);
    }

    if (params?.until) {
      query = query.lt("updated_at", params.until);
    }

    const { count } = await query;
    return count ?? 0;
  }, []);

  const loadStats = useCallback(async () => {
    if (isSchoolScoped && userSchoolId) {
      const [schoolRes, primaryStudentsRes, simuladoStudentsRes, coordinatorsRes, pdfsRes, studentIds] =
        await Promise.all([
          supabase.from("schools").select("id").eq("id", userSchoolId).maybeSingle(),
          supabase
            .from("students")
            .select("matricula")
            .eq("school_id", userSchoolId),
          simuladoSupabase
            .from("students")
            .select("matricula")
            .eq("school_id", userSchoolId),
          supabase
            .from("project_users")
            .select("auth_uid", { count: "exact" })
            .eq("role", "coordinator")
            .eq("is_active", true)
            .eq("school_id", userSchoolId),
          supabase
            .from("pdf_history")
            .select("id, file_size")
            .eq("school_id", userSchoolId),
          loadScopedStudentIds(),
        ]);

      const { data: cronogramasData } =
        studentIds.length > 0
          ? await supabase
              .from("cronogramas")
              .select("id, aluno_id, created_at, updated_at")
              .in("aluno_id", studentIds)
          : { data: [] };

      const cronogramas = cronogramasData ?? [];
      const cronogramaIds = cronogramas.map((cronograma) => cronograma.id);
      const todayStart = startOfDay(0);
      const weekStart = startOfDay(7);

      const { count: blocosCount } =
        cronogramaIds.length > 0
          ? await supabase
              .from("blocos_cronograma")
              .select("id", { count: "exact" })
              .in("cronograma_id", cronogramaIds)
          : { count: 0 };

      const totalCronogramas = cronogramas.length;
      const cronogramasToday = cronogramas.filter(
        (cronograma) => (cronograma.updated_at ?? cronograma.created_at) >= todayStart,
      ).length;
      const cronogramasWeek = cronogramas.filter(
        (cronograma) => (cronograma.updated_at ?? cronograma.created_at) >= weekStart,
      ).length;
      const studentsWithCronograma = new Set(
        cronogramas.map((cronograma) => cronograma.aluno_id),
      ).size;
      const totalBlocos = blocosCount ?? 0;
      const mediaBlocosPorAluno =
        studentsWithCronograma > 0 ? Math.round(totalBlocos / studentsWithCronograma) : 0;
      const totalStudents = new Set(
        [...(primaryStudentsRes.data ?? []), ...(simuladoStudentsRes.data ?? [])]
          .map((student) => student.matricula)
          .filter(
            (matricula): matricula is string =>
              typeof matricula === "string" && matricula.trim().length > 0,
          ),
      ).size;

      const storageBytes = (pdfsRes.data ?? []).reduce(
        (total, record) => total + (record.file_size ?? 0),
        0,
      );

      setStats({
        total_schools: schoolRes.data ? 1 : 0,
        total_coordinators: coordinatorsRes.count ?? 0,
        total_students: totalStudents,
        students_with_cronograma: studentsWithCronograma,
        total_cronogramas: totalCronogramas,
        total_blocos: totalBlocos,
        media_blocos_por_aluno: mediaBlocosPorAluno,
        total_pdfs: pdfsRes.data?.length ?? 0,
        storage_bytes: storageBytes,
        cronogramas_today: cronogramasToday,
        cronogramas_week: cronogramasWeek,
        api_calls_today: 0,
        api_errors_today: 0,
      });
      return;
    }

    const [rpcRes, cronogramasRes, blocosRes] = await Promise.all([
      supabase.rpc("get_admin_dashboard_stats"),
      supabase.from("cronogramas").select("id, aluno_id, created_at, updated_at"),
      supabase.from("blocos_cronograma").select("id", { count: "exact" }),
    ]);

    if (rpcRes.data) {
      const cronogramas = cronogramasRes.data ?? [];
      const studentsWithCronograma = new Set(
        cronogramas.map((cronograma) => cronograma.aluno_id),
      ).size;
      const totalBlocos = blocosRes.count ?? 0;

      setStats({
        ...(rpcRes.data as unknown as Omit<DashboardStats, "students_with_cronograma" | "total_blocos" | "media_blocos_por_aluno">),
        students_with_cronograma: studentsWithCronograma,
        total_blocos: totalBlocos,
        media_blocos_por_aluno:
          studentsWithCronograma > 0 ? Math.round(totalBlocos / studentsWithCronograma) : 0,
      });
    }
  }, [
    isSchoolScoped,
    loadScopedStudentIds,
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
    const scopedStudentIds =
      isSchoolScoped && userSchoolId ? await loadScopedStudentIds() : [];

    const days: DailyCronograma[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfDay(i);
      const dayEnd = i === 0 ? new Date().toISOString() : startOfDay(i - 1);

      const count =
        isSchoolScoped && userSchoolId
          ? await countScopedCronogramas({
              studentIds: scopedStudentIds,
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
  }, [countScopedCronogramas, isSchoolScoped, loadScopedStudentIds, userSchoolId]);

  const loadSchoolHealth = useCallback(async () => {
    const weekAgo = startOfDay(7);

    if (isSchoolScoped && userSchoolId) {
      const [schoolRes, coordinatorsRes, auditRes, studentIds] = await Promise.all([
        supabase
          .from("schools")
          .select("id, name")
          .eq("id", userSchoolId)
          .maybeSingle(),
        supabase
          .from("project_users")
          .select("auth_uid", { count: "exact" })
          .eq("role", "coordinator")
          .eq("is_active", true)
          .eq("school_id", userSchoolId),
        supabase
          .from("audit_log")
          .select("created_at")
          .eq("school_id", userSchoolId)
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: false })
          .limit(1),
        loadScopedStudentIds(),
      ]);

      if (!schoolRes.data) {
        setSchoolHealth([]);
        return;
      }

      const cronogramasWeek = await countScopedCronogramas({
        studentIds,
        since: weekAgo,
      });

      setSchoolHealth([
        {
          id: schoolRes.data.id,
          name: schoolRes.data.name,
          coordinator_count: coordinatorsRes.count ?? 0,
          cronogramas_week: cronogramasWeek,
          last_activity: auditRes.data?.[0]?.created_at ?? null,
        },
      ]);
      return;
    }

    const [schoolsRes, primaryStudentsRes, simuladoStudentsRes, cronogramasRes, coordinatorsRes, auditRes] =
      await Promise.all([
        supabase.from("schools").select("id, name"),
        supabase.from("students").select("matricula, school_id"),
        simuladoSupabase.from("students").select("matricula, school_id"),
        supabase
          .from("cronogramas")
          .select("aluno_id, created_at, updated_at")
          .gte("updated_at", weekAgo),
        supabase
          .from("project_users")
          .select("school_id, role, is_active")
          .eq("role", "coordinator")
          .eq("is_active", true),
        supabase
          .from("audit_log")
          .select("school_id, created_at")
          .not("school_id", "is", null)
          .gte("created_at", weekAgo),
      ]);

    const schools = schoolsRes.data ?? [];
    if (schools.length === 0) {
      setSchoolHealth([]);
      return;
    }

    const studentSchoolByMatricula = new Map<string, string>();
    for (const student of [...(primaryStudentsRes.data ?? []), ...(simuladoStudentsRes.data ?? [])]) {
      if (student.matricula && student.school_id) {
        studentSchoolByMatricula.set(student.matricula, student.school_id);
      }
    }

    const cronogramasBySchool = new Map<string, number>();
    for (const cronograma of cronogramasRes.data ?? []) {
      const schoolId = studentSchoolByMatricula.get(cronograma.aluno_id);
      if (!schoolId) continue;
      cronogramasBySchool.set(
        schoolId,
        (cronogramasBySchool.get(schoolId) ?? 0) + 1,
      );
    }

    const coordinatorsBySchool = new Map<string, number>();
    for (const coordinator of coordinatorsRes.data ?? []) {
      if (!coordinator.school_id) continue;
      coordinatorsBySchool.set(
        coordinator.school_id,
        (coordinatorsBySchool.get(coordinator.school_id) ?? 0) + 1,
      );
    }

    const lastActivityBySchool = new Map<string, string>();
    for (const entry of auditRes.data ?? []) {
      if (!entry.school_id) continue;
      const previous = lastActivityBySchool.get(entry.school_id);
      if (!previous || new Date(entry.created_at).getTime() > new Date(previous).getTime()) {
        lastActivityBySchool.set(entry.school_id, entry.created_at);
      }
    }

    setSchoolHealth(
      schools.map((school) => ({
        id: school.id,
        name: school.name,
        coordinator_count: coordinatorsBySchool.get(school.id) ?? 0,
        cronogramas_week: cronogramasBySchool.get(school.id) ?? 0,
        last_activity: lastActivityBySchool.get(school.id) ?? null,
      })),
    );
  }, [
    countScopedCronogramas,
    isSchoolScoped,
    loadScopedStudentIds,
    userSchoolId,
  ]);

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
          Esta tela responde ao básico de auditoria operacional: quantos alunos já têm
          cronograma, quantos cronogramas e blocos foram montados, quantos PDFs ficaram
          registrados e qual foi a atividade recente da equipe.
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8] mb-3">
              Produção da operação
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Alunos com cronograma"
                value={stats.students_with_cronograma}
                subtitle="Alunos já atendidos com plano montado"
                icon={<IconStudent />}
              />
              <KpiCard
                label="Cronogramas gerados"
                value={stats.total_cronogramas}
                subtitle={`${stats.cronogramas_today} hoje / ${stats.cronogramas_week} esta semana`}
                icon={<IconCalendar />}
              />
              <KpiCard
                label="Blocos criados"
                value={stats.total_blocos}
                subtitle={`${stats.media_blocos_por_aluno} blocos por aluno, em média`}
                icon={<IconCalendar />}
              />
              <KpiCard
                label="PDFs registrados"
                value={stats.total_pdfs}
                subtitle="Histórico de relatórios, cadernos e cronogramas"
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
                value={stats.total_schools}
                icon={<IconSchool />}
              />
              <KpiCard label="Coordenadores" value={stats.total_coordinators} icon={<IconUsers />} />
              <KpiCard label="Alunos totais" value={stats.total_students} icon={<IconStudent />} />
              <KpiCard label="Armazenamento" value={formatBytes(stats.storage_bytes)} icon={<IconStorage />} />
            </div>
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schoolHealth.map((school) => {
              const lastMs = school.last_activity ? renderTimestamp - new Date(school.last_activity).getTime() : Infinity;
              const dayMs = 86_400_000;
              const dotColor =
                lastMs < dayMs ? "bg-[#10b981]" : lastMs < dayMs * 7 ? "bg-[#f59e0b]" : "bg-[#dc2626]";

              return (
                <div key={school.id} className="bg-white rounded-2xl border border-[#e5e7eb] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <h4 className="text-sm font-semibold text-[#1d1d1f] truncate">{school.name}</h4>
                  </div>
                  <div className="flex gap-4 text-xs text-[#64748b]">
                    <span>{school.coordinator_count} coordenadores</span>
                    <span>{school.cronogramas_week} cronogramas/semana</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
