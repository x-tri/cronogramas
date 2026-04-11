import { useCallback, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";
import { simuladoSupabase } from "../../lib/simulado-supabase";
import { logAudit } from "../../services/audit";

interface School {
  id: string;
  name: string;
}

interface AlunoControle {
  aluno_id: string;
  nome: string;
  turma: string;
  matricula: string;
  escola: string;
  school_id: string | null;
  total_cronogramas: number;
  total_blocos: number;
  ultimo_cronograma: string | null;
}

interface CronogramaVersionRow {
  id: string;
  semana_inicio: string;
  semana_fim: string;
  created_at: string;
  updated_at: string | null;
  status: "ativo" | "arquivado";
  observacoes: string | null;
}

interface StudentLookupRow {
  id: string;
  name: string | null;
  turma: string | null;
  matricula: string;
  school_id: string | null;
}

interface AdminControleProps {
  onBack: () => void;
  embedded?: boolean;
  userRole?: string | null;
  userSchoolId?: string | null;
}

export function AdminControle({
  onBack,
  embedded,
  userRole = null,
  userSchoolId = null,
}: AdminControleProps) {
  const [alunos, setAlunos] = useState<AlunoControle[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deletingCronogramaId, setDeletingCronogramaId] = useState<string | null>(null);
  const [filterTurma, setFilterTurma] = useState("");
  const [sortBy, setSortBy] = useState<"nome" | "turma" | "blocos" | "data">("data");
  const [selectedAluno, setSelectedAluno] = useState<AlunoControle | null>(null);
  const [selectedAlunoVersions, setSelectedAlunoVersions] = useState<CronogramaVersionRow[]>([]);
  const [unlinkingMatricula, setUnlinkingMatricula] = useState<string | null>(null);
  const [googleLinkedStudents, setGoogleLinkedStudents] = useState<Set<string>>(new Set());
  const isSchoolScoped = userRole !== "super_admin" && Boolean(userSchoolId);
  const effectiveSelectedSchool = isSchoolScoped ? (userSchoolId ?? "") : selectedSchool;

  const loadData = useCallback(async () => {
    setLoading(true);

    // Junta alunos do banco principal e do banco dedicado de simulados para não
    // classificar como "Avulso" cronogramas de alunos reais que só existem na origem do simulado.
    const schoolsQuery = isSchoolScoped && userSchoolId
      ? supabase.from("schools").select("id, name").eq("id", userSchoolId).order("name")
      : supabase.from("schools").select("id, name").order("name");

    const primaryStudentsQuery = isSchoolScoped && userSchoolId
      ? supabase
          .from("students")
          .select("id, name, turma, matricula, school_id")
          .eq("school_id", userSchoolId)
      : supabase.from("students").select("id, name, turma, matricula, school_id");

    const simuladoStudentsQuery = isSchoolScoped && userSchoolId
      ? simuladoSupabase
          .from("students")
          .select("id, name, turma, matricula, school_id")
          .eq("school_id", userSchoolId)
      : simuladoSupabase.from("students").select("id, name, turma, matricula, school_id");

    const [schoolsRes, primaryStudentsRes, simuladoStudentsRes] = await Promise.all([
      schoolsQuery,
      primaryStudentsQuery,
      simuladoStudentsQuery,
    ]);

    setSchools(schoolsRes.data ?? []);

    const scopedStudentMap = new Map<string, StudentLookupRow>();
    for (const student of [
      ...((primaryStudentsRes.data ?? []) as StudentLookupRow[]),
      ...((simuladoStudentsRes.data ?? []) as StudentLookupRow[]),
    ]) {
      if (!scopedStudentMap.has(student.matricula)) {
        scopedStudentMap.set(student.matricula, student);
      }
      if (!scopedStudentMap.has(student.id)) {
        scopedStudentMap.set(student.id, student);
      }
    }
    const scopedStudents = [...new Set(scopedStudentMap.values())];
    const scopedAlunoIds = Array.from(
      new Set(
        scopedStudents.flatMap((student) =>
          [student.id, student.matricula].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          ),
        ),
      ),
    );

    if (isSchoolScoped && scopedAlunoIds.length === 0) {
      setAlunos([]);
      setLoading(false);
      return;
    }

    let cronogramasQuery = supabase
      .from("cronogramas")
      .select("aluno_id, id, created_at, updated_at");
    if (isSchoolScoped && scopedAlunoIds.length > 0) {
      cronogramasQuery = cronogramasQuery.in("aluno_id", scopedAlunoIds);
    }

    const { data: cronogramasData } = await cronogramasQuery;
    const cronogramas = cronogramasData ?? [];
    if (cronogramas.length === 0) {
      setAlunos([]);
      setLoading(false);
      return;
    }

    // Group by aluno_id
    const alunoMap = new Map<string, { count: number; lastDate: string; cronogramaIds: string[] }>();
    for (const c of cronogramas) {
      const activityAt = c.updated_at ?? c.created_at;
      const existing = alunoMap.get(c.aluno_id);
      if (existing) {
        existing.count++;
        existing.cronogramaIds.push(c.id);
        if (activityAt > existing.lastDate) existing.lastDate = activityAt;
      } else {
        alunoMap.set(c.aluno_id, { count: 1, lastDate: activityAt, cronogramaIds: [c.id] });
      }
    }

    // Count blocos per cronograma
    const allCronogramaIds = cronogramas.map((c) => c.id);
    const { data: blocosData } = await supabase
      .from("blocos_cronograma")
      .select("cronograma_id")
      .in("cronograma_id", allCronogramaIds);

    const cronogramaOwnerById = new Map<string, string>();
    for (const [alunoId, info] of alunoMap) {
      for (const cronogramaId of info.cronogramaIds) {
        cronogramaOwnerById.set(cronogramaId, alunoId);
      }
    }

    const blocosByAluno = new Map<string, number>();
    for (const b of blocosData ?? []) {
      const alunoId = cronogramaOwnerById.get(b.cronograma_id);
      if (!alunoId) continue;
      blocosByAluno.set(alunoId, (blocosByAluno.get(alunoId) ?? 0) + 1);
    }

    // Resolve student info
    const alunoIds = Array.from(alunoMap.keys());
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids = alunoIds.filter((id) => uuidRegex.test(id));
    const matriculas = alunoIds.filter((id) => !uuidRegex.test(id));

    const [primaryByUuid, primaryByMatricula] = isSchoolScoped
      ? [
          { data: scopedStudents.filter((student) => uuids.includes(student.id)) },
          { data: scopedStudents.filter((student) => matriculas.includes(student.matricula)) },
        ]
      : await Promise.all([
          uuids.length > 0
            ? supabase.from("students").select("id, name, turma, matricula, school_id").in("id", uuids)
            : Promise.resolve({ data: null }),
          matriculas.length > 0
            ? supabase.from("students").select("id, name, turma, matricula, school_id").in("matricula", matriculas)
            : Promise.resolve({ data: null }),
        ]);

    const studentById = new Map<string, StudentLookupRow>();
    const studentByMatricula = new Map<string, StudentLookupRow>();
    const registerStudents = (rows: readonly StudentLookupRow[]) => {
      for (const student of rows) {
        if (!studentById.has(student.id)) {
          studentById.set(student.id, student);
        }
        if (!studentByMatricula.has(student.matricula)) {
          studentByMatricula.set(student.matricula, student);
        }
      }
    };

    registerStudents((primaryByUuid.data ?? []) as StudentLookupRow[]);
    registerStudents((primaryByMatricula.data ?? []) as StudentLookupRow[]);

    const unresolvedUuids = uuids.filter((id) => !studentById.has(id));
    const unresolvedMatriculas = matriculas.filter((matricula) => !studentByMatricula.has(matricula));

    const [simuladoByUuid, simuladoByMatricula] = unresolvedUuids.length > 0 || unresolvedMatriculas.length > 0
      ? await Promise.all([
          unresolvedUuids.length > 0
            ? (() => {
                let query = simuladoSupabase
                  .from("students")
                  .select("id, name, turma, matricula, school_id")
                  .in("id", unresolvedUuids);
                if (isSchoolScoped && userSchoolId) {
                  query = query.eq("school_id", userSchoolId);
                }
                return query;
              })()
            : Promise.resolve({ data: null }),
          unresolvedMatriculas.length > 0
            ? (() => {
                let query = simuladoSupabase
                  .from("students")
                  .select("id, name, turma, matricula, school_id")
                  .in("matricula", unresolvedMatriculas);
                if (isSchoolScoped && userSchoolId) {
                  query = query.eq("school_id", userSchoolId);
                }
                return query;
              })()
            : Promise.resolve({ data: null }),
        ])
      : [{ data: null }, { data: null }];

    registerStudents((simuladoByUuid.data ?? []) as StudentLookupRow[]);
    registerStudents((simuladoByMatricula.data ?? []) as StudentLookupRow[]);

    // Coordenador não deve resolver aluno avulso de outra origem fora da escola dele.
    const avulsoMap = new Map<string, { nome: string; matricula: string; turma: string }>();
    if (!isSchoolScoped && unresolvedUuids.length > 0) {
      const { data: avulsos } = await supabase
        .from("alunos_avulsos_cronograma")
        .select("id, nome, matricula, turma")
        .in("id", unresolvedUuids);
      for (const a of avulsos ?? []) {
        avulsoMap.set(a.id, a);
      }
    }

    // School name lookup
    const schoolMap = new Map<string, string>();
    for (const s of schoolsRes.data ?? []) schoolMap.set(s.id, s.name);

    // Build result
    const result: AlunoControle[] = [];
    for (const [alunoId, info] of alunoMap) {
      const student = studentById.get(alunoId) ?? studentByMatricula.get(alunoId);
      const avulso = avulsoMap.get(alunoId);

      result.push({
        aluno_id: alunoId,
        nome: student?.name ?? avulso?.nome ?? alunoId.slice(0, 12),
        turma: student?.turma ?? avulso?.turma ?? "-",
        matricula: student?.matricula ?? avulso?.matricula ?? (uuidRegex.test(alunoId) ? "-" : alunoId),
        escola: student?.school_id ? (schoolMap.get(student.school_id) ?? "-") : "Avulso",
        school_id: student?.school_id ?? null,
        total_cronogramas: info.count,
        total_blocos: blocosByAluno.get(alunoId) ?? 0,
        ultimo_cronograma: info.lastDate,
      });
    }

    setAlunos(result);

    // Carregar alunos com Google vinculado
    const googleCheckMatriculas = result.map((a) => a.matricula).filter((m) => m !== "-");
    if (googleCheckMatriculas.length > 0) {
      const { data: linked } = await supabase
        .from("students")
        .select("matricula, profile_id")
        .in("matricula", googleCheckMatriculas)
        .not("profile_id", "is", null);

      if (linked) {
        // Verificar quais profile_ids são de Google (não @aluno.xtri.com)
        const profileIds = linked.map((l) => l.profile_id).filter(Boolean) as string[];
        if (profileIds.length > 0) {
          const { data: googleUsers } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", profileIds);

          const googleSet = new Set<string>();
          for (const gu of googleUsers ?? []) {
            if (gu.email && !gu.email.endsWith("@aluno.xtri.com")) {
              const matchedStudent = linked.find((l) => l.profile_id === gu.id);
              if (matchedStudent) googleSet.add(matchedStudent.matricula);
            }
          }
          setGoogleLinkedStudents(googleSet);
        }
      }
    }

    setLoading(false);
  }, [isSchoolScoped, userSchoolId]);

  const handleUnlinkGoogle = useCallback(async (matricula: string, nome: string) => {
    if (!confirm(`Desvincular conta Google de ${nome} (${matricula})?\n\nO aluno precisará vincular novamente no próximo login.`)) return;

    setUnlinkingMatricula(matricula);

    // Buscar profile_id atual
    const { data: student } = await supabase
      .from("students")
      .select("profile_id")
      .eq("matricula", matricula)
      .single();

    if (student?.profile_id) {
      // Remover project_user do Google
      await supabase
        .from("project_users")
        .delete()
        .eq("auth_uid", student.profile_id)
        .eq("role", "student");

      // Remover profile do Google
      await supabase
        .from("profiles")
        .delete()
        .eq("id", student.profile_id)
        .not("email", "like", "%@aluno.xtri.com");

      // Limpar profile_id do student
      await supabase
        .from("students")
        .update({ profile_id: null })
        .eq("matricula", matricula);

      logAudit("update_block", "student_google_unlink", matricula, { nome });

      setGoogleLinkedStudents((prev) => {
        const next = new Set(prev);
        next.delete(matricula);
        return next;
      });
    }

    setUnlinkingMatricula(null);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  // Filter & sort
  const turmas = [...new Set(alunos.map((a) => a.turma))].filter((t) => t !== "-").sort();

  let filtered = alunos;
  if (effectiveSelectedSchool) {
    filtered = filtered.filter((a) => a.school_id === effectiveSelectedSchool);
  }
  if (filterTurma) filtered = filtered.filter((a) => a.turma === filterTurma);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "nome") return a.nome.localeCompare(b.nome);
    if (sortBy === "turma") return a.turma.localeCompare(b.turma) || a.nome.localeCompare(b.nome);
    if (sortBy === "blocos") return b.total_blocos - a.total_blocos;
    // data (mais recente primeiro)
    return (b.ultimo_cronograma ?? "").localeCompare(a.ultimo_cronograma ?? "");
  });

  function exportCSV() {
    const BOM = "\uFEFF";
    const header = "Nome;Turma;Matrícula;Escola;Cronogramas;Blocos;Último Cronograma\n";
    const rows = sorted
      .map((a) =>
        [
          a.nome,
          a.turma,
          a.matricula,
          a.escola,
          a.total_cronogramas,
          a.total_blocos,
          a.ultimo_cronograma ? new Date(a.ultimo_cronograma).toLocaleDateString("pt-BR") : "-",
        ].join(";"),
      )
      .join("\n");

    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const schoolName = effectiveSelectedSchool
      ? schools.find((s) => s.id === effectiveSelectedSchool)?.name ?? "escola"
      : "todas-escolas";
    a.download = `controle-cronogramas-${schoolName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function closeVersionsModal() {
    setSelectedAluno(null);
    setSelectedAlunoVersions([]);
    setLoadingVersions(false);
    setDeletingCronogramaId(null);
  }

  async function openVersionsModal(aluno: AlunoControle) {
    setSelectedAluno(aluno);
    setSelectedAlunoVersions([]);
    setLoadingVersions(true);

    const { data, error } = await supabase
      .from("cronogramas")
      .select("id, semana_inicio, semana_fim, created_at, updated_at, status, observacoes")
      .eq("aluno_id", aluno.aluno_id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[AdminControle] Falha ao carregar versões do cronograma:", error);
      setLoadingVersions(false);
      return;
    }

    setSelectedAlunoVersions((data ?? []) as CronogramaVersionRow[]);
    setLoadingVersions(false);
  }

  async function handleDeleteCronograma(
    aluno: AlunoControle,
    version: CronogramaVersionRow,
  ) {
    const semanaLabel = `${new Date(version.semana_inicio).toLocaleDateString("pt-BR")} a ${new Date(version.semana_fim).toLocaleDateString("pt-BR")}`;
    const confirmDelete = window.confirm(
      `Excluir o cronograma de ${aluno.nome} da semana ${semanaLabel}? Os blocos dessa versão também serão removidos.`,
    );

    if (!confirmDelete) {
      return;
    }

    setDeletingCronogramaId(version.id);

    const { error } = await supabase
      .from("cronogramas")
      .delete()
      .eq("id", version.id);

    if (error) {
      console.error("[AdminControle] Falha ao excluir cronograma:", error);
      setDeletingCronogramaId(null);
      return;
    }

    logAudit("delete_cronograma", "cronograma", version.id, {
      alunoId: aluno.aluno_id,
      matricula: aluno.matricula,
      alunoNome: aluno.nome,
      semanaInicio: version.semana_inicio,
      semanaFim: version.semana_fim,
      origem: "admin_controle",
    });

    const nextVersions = selectedAlunoVersions.filter((item) => item.id !== version.id);
    setSelectedAlunoVersions(nextVersions);
    setDeletingCronogramaId(null);
    await loadData();

    if (nextVersions.length === 0) {
      closeVersionsModal();
    }
  }

  const versionsFooter = selectedAluno ? (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-[#64748b]">
        Escolha a semana exata antes de excluir.
      </p>
      <button
        onClick={closeVersionsModal}
        className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-[#f8fafc]"
      >
        Fechar
      </button>
    </div>
  ) : undefined;

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
      </main>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-[#f5f5f7]"}>
      {!embedded && (
        <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex h-12 items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="flex items-center gap-1 text-sm text-[#2563eb] hover:text-[#1d4ed8] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>
                <div className="h-4 w-px bg-[#e5e7eb]" />
                <h1 className="text-sm font-medium text-[#1d1d1f]">Cronogramas dos alunos</h1>
              </div>
              <button
                onClick={exportCSV}
                disabled={sorted.length === 0}
                className="rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#166534] disabled:opacity-50"
              >
                Exportar Excel (.csv)
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? "px-6 py-4 space-y-6" : "mx-auto max-w-6xl px-6 py-6 space-y-4"}>
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{alunos.length}</p>
            <p className="text-xs text-[#64748b]">Alunos com cronograma</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">
              {alunos.reduce((sum, a) => sum + a.total_blocos, 0)}
            </p>
            <p className="text-xs text-[#64748b]">Total de blocos criados</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">
              {alunos.length > 0
                ? Math.round(alunos.reduce((sum, a) => sum + a.total_blocos, 0) / alunos.length)
                : 0}
            </p>
            <p className="text-xs text-[#64748b]">Media blocos/aluno</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          {!isSchoolScoped && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#64748b]">Escola:</label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] min-w-[180px]"
              >
                <option value="">Todas</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748b]">Turma:</label>
            <select
              value={filterTurma}
              onChange={(e) => setFilterTurma(e.target.value)}
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f]"
            >
              <option value="">Todas</option>
              {turmas.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748b]">Ordenar:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f]"
            >
              <option value="data">Mais recente</option>
              <option value="nome">Nome A-Z</option>
              <option value="turma">Turma</option>
              <option value="blocos">Mais blocos</option>
            </select>
          </div>
          <span className="text-xs text-[#94a3b8]">{sorted.length} alunos</span>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Turma
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">
                  Matricula
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden lg:table-cell">
                  Escola
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Blocos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">
                  Ultimo
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-[#94a3b8]">
                    Nenhum aluno criou cronograma ainda
                  </td>
                </tr>
              ) : (
                sorted.map((a) => (
                  <tr key={a.aluno_id} className="border-b border-[#f1f5f9] hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-[#1d1d1f]">
                      {a.nome}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">
                        {a.turma}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#64748b] hidden md:table-cell">
                      {a.matricula}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#64748b] hidden lg:table-cell">
                      {a.escola}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block min-w-[32px] rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.total_blocos >= 30
                          ? "bg-[#f0fdf4] text-[#15803d]"
                          : a.total_blocos >= 10
                            ? "bg-[#fef3c7] text-[#92400e]"
                            : "bg-[#fef2f2] text-[#dc2626]"
                      }`}>
                        {a.total_blocos}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#94a3b8] hidden md:table-cell">
                      {a.ultimo_cronograma
                        ? new Date(a.ultimo_cronograma).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {googleLinkedStudents.has(a.matricula) && (
                          <button
                            onClick={() => void handleUnlinkGoogle(a.matricula, a.nome)}
                            disabled={unlinkingMatricula === a.matricula}
                            className="rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#f1f5f9] disabled:opacity-50"
                            title="Desvincular conta Google deste aluno"
                          >
                            {unlinkingMatricula === a.matricula ? "..." : "🔓 Google"}
                          </button>
                        )}
                        <button
                          onClick={() => void openVersionsModal(a)}
                          className="rounded-lg border border-[#fecaca] bg-white px-3 py-1.5 text-xs font-medium text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                        >
                          Excluir cronograma
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal
          isOpen={Boolean(selectedAluno)}
          onClose={closeVersionsModal}
          title={selectedAluno ? `Cronogramas de ${selectedAluno.nome}` : "Cronogramas"}
          footer={versionsFooter}
        >
          {selectedAluno && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
                <p className="text-sm font-semibold text-[#1d1d1f]">{selectedAluno.nome}</p>
                <p className="mt-1 text-xs text-[#64748b]">
                  Turma {selectedAluno.turma} · Matrícula {selectedAluno.matricula} · {selectedAluno.total_cronogramas} cronograma(s)
                </p>
              </div>

              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
                </div>
              ) : selectedAlunoVersions.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#94a3b8]">
                  Nenhuma versão encontrada para este aluno.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedAlunoVersions.map((version) => {
                    const isDeleting = deletingCronogramaId === version.id;
                    const semana = `${new Date(version.semana_inicio).toLocaleDateString("pt-BR")} a ${new Date(version.semana_fim).toLocaleDateString("pt-BR")}`;
                    const activityAt = version.updated_at ?? version.created_at;
                    const alteradoEm = new Date(activityAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={version.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#1d1d1f]">
                              {semana}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              version.status === "ativo"
                                ? "bg-[#dcfce7] text-[#15803d]"
                                : "bg-[#e5e7eb] text-[#475569]"
                            }`}>
                              {version.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#64748b]">
                            Última alteração em {alteradoEm}
                          </p>
                          {version.observacoes && (
                            <p className="mt-1 text-xs text-[#94a3b8]">
                              {version.observacoes}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => void handleDeleteCronograma(selectedAluno, version)}
                          disabled={isDeleting}
                          className="rounded-lg border border-[#fecaca] bg-white px-3 py-1.5 text-xs font-medium text-[#dc2626] transition-colors hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
