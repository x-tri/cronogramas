import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

interface AdminControleProps {
  onBack: () => void;
  embedded?: boolean;
}

export function AdminControle({ onBack, embedded }: AdminControleProps) {
  const [alunos, setAlunos] = useState<AlunoControle[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterTurma, setFilterTurma] = useState("");
  const [sortBy, setSortBy] = useState<"nome" | "turma" | "blocos" | "data">("data");

  const loadData = useCallback(async () => {
    setLoading(true);

    const [schoolsRes, cronogramasRes] = await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      supabase.from("cronogramas").select("aluno_id, id, created_at"),
    ]);

    setSchools(schoolsRes.data ?? []);

    const cronogramas = cronogramasRes.data ?? [];
    if (cronogramas.length === 0) {
      setAlunos([]);
      setLoading(false);
      return;
    }

    // Group by aluno_id
    const alunoMap = new Map<string, { count: number; lastDate: string; cronogramaIds: string[] }>();
    for (const c of cronogramas) {
      const existing = alunoMap.get(c.aluno_id);
      if (existing) {
        existing.count++;
        existing.cronogramaIds.push(c.id);
        if (c.created_at > existing.lastDate) existing.lastDate = c.created_at;
      } else {
        alunoMap.set(c.aluno_id, { count: 1, lastDate: c.created_at, cronogramaIds: [c.id] });
      }
    }

    // Count blocos per cronograma
    const allCronogramaIds = cronogramas.map((c) => c.id);
    const { data: blocosData } = await supabase
      .from("blocos_cronograma")
      .select("cronograma_id")
      .in("cronograma_id", allCronogramaIds);

    const blocosByAluno = new Map<string, number>();
    for (const b of blocosData ?? []) {
      // find which aluno owns this cronograma
      for (const [alunoId, info] of alunoMap) {
        if (info.cronogramaIds.includes(b.cronograma_id)) {
          blocosByAluno.set(alunoId, (blocosByAluno.get(alunoId) ?? 0) + 1);
          break;
        }
      }
    }

    // Resolve student info
    const alunoIds = Array.from(alunoMap.keys());
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids = alunoIds.filter((id) => uuidRegex.test(id));
    const matriculas = alunoIds.filter((id) => !uuidRegex.test(id));

    type StudentRow = { id: string; name: string; turma: string; matricula: string; school_id: string };

    const [byUuid, byMatricula] = await Promise.all([
      uuids.length > 0
        ? supabase.from("students").select("id, name, turma, matricula, school_id").in("id", uuids)
        : Promise.resolve({ data: null }),
      matriculas.length > 0
        ? supabase.from("students").select("id, name, turma, matricula, school_id").in("matricula", matriculas)
        : Promise.resolve({ data: null }),
    ]);

    const studentById = new Map<string, StudentRow>();
    for (const s of (byUuid.data ?? []) as StudentRow[]) studentById.set(s.id, s);
    const studentByMatricula = new Map<string, StudentRow>();
    for (const s of (byMatricula.data ?? []) as StudentRow[]) studentByMatricula.set(s.matricula, s);

    // Also check alunos_avulsos
    const unresolvedUuids = uuids.filter((id) => !studentById.has(id));
    const avulsoMap = new Map<string, { nome: string; matricula: string; turma: string }>();
    if (unresolvedUuids.length > 0) {
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
    setLoading(false);
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
  if (selectedSchool) filtered = filtered.filter((a) => a.school_id === selectedSchool);
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
    const schoolName = selectedSchool
      ? schools.find((s) => s.id === selectedSchool)?.name ?? "escola"
      : "todas-escolas";
    a.download = `controle-cronogramas-${schoolName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
                <h1 className="text-sm font-medium text-[#1d1d1f]">Controle de Cronogramas</h1>
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
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-[#94a3b8]">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
