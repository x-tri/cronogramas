import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { logAudit } from "../../services/audit";

interface School {
  id: string;
  name: string;
  slug: string;
}

interface ProjectUser {
  id: string;
  auth_uid: string | null;
  email: string;
  name: string | null;
  school_id: string | null;
  role: string;
  allowed_series: string[] | null;
  is_active: boolean;
  created_at: string;
  school: School | null;
}

interface AdminCoordinadoresProps {
  onBack: () => void;
  embedded?: boolean;
}

export function AdminCoordinadores({ onBack, embedded }: AdminCoordinadoresProps) {
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<ProjectUser[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterSchool, setFilterSchool] = useState("");

  const loadData = useCallback(async () => {
    const [usersRes, schoolsRes] = await Promise.all([
      supabase
        .from("project_users")
        .select("*, school:schools(id, name, slug)")
        .eq("is_active", true)
        .order("role")
        .order("name"),
      supabase.from("schools").select("*").order("name"),
    ]);

    const allUsers = (usersRes.data ?? []) as ProjectUser[];
    // Usuarios com auth_uid = linked (ja logaram)
    setUsers(allUsers.filter((u) => u.auth_uid !== null));
    // Usuarios sem auth_uid = convite pendente (nunca logaram)
    setPendingInvites(allUsers.filter((u) => u.auth_uid === null));
    setSchools(schoolsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCoordinators = users.filter((u) => u.role !== "super_admin");
  const filtered = filterSchool
    ? activeCoordinators.filter((c) => c.school_id === filterSchool)
    : activeCoordinators;

  const filteredInvites = filterSchool
    ? pendingInvites.filter((i) => i.school_id === filterSchool)
    : pendingInvites;

  async function handleRemove(email: string) {
    if (!confirm(`Remover ${email} do projeto?`)) return;
    const { data, error } = await supabase.rpc("remove_project_user", {
      p_email: email,
    });
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    logAudit("remove_coordinator", "coordinator", email);
    alert(String(data));
    loadData();
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
      {/* Header */}
      {!embedded && (
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6">
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
              <h1 className="text-sm font-medium text-[#1d1d1f]">
                Usuarios do Projeto
              </h1>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1d4ed8]"
            >
              + Adicionar
            </button>
          </div>
        </div>
      </header>
      )}

      <main className={embedded ? "px-6 py-4 space-y-6" : "mx-auto max-w-5xl px-6 py-8 space-y-6"}>
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{activeCoordinators.length}</p>
            <p className="text-xs text-[#64748b]">Coordenadores ativos</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{pendingInvites.length}</p>
            <p className="text-xs text-[#64748b]">Convites pendentes</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{schools.length}</p>
            <p className="text-xs text-[#64748b]">Escolas</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label htmlFor="schoolFilter" className="text-xs text-[#64748b]">
            Filtrar por escola:
          </label>
          <select
            id="schoolFilter"
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe] min-w-[200px]"
          >
            <option value="">Todas as escolas</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Escola
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#94a3b8]">
                    Nenhum coordenador neste projeto
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[#f1f5f9] hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#1d1d1f]">
                      {u.name || u.email.split("@")[0]}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748b] font-mono">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-medium text-[#1d4ed8]">
                        {u.school?.name ?? "Sem escola"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "coordinator"
                          ? "bg-[#f0fdf4] text-[#15803d]"
                          : "bg-[#fef3c7] text-[#92400e]"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-[#15803d]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                        Ativo
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(u.email)}
                        className="rounded-lg border border-[#fecaca] px-2.5 py-1 text-xs text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pending Invites */}
        {filteredInvites.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-[#1d1d1f] mt-6">
              Convites Pendentes
              <span className="ml-2 text-xs font-normal text-[#94a3b8]">
                (aguardando primeiro login)
              </span>
            </h2>
            <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                      Escola
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvites.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#f1f5f9] hover:bg-[#fafafa]">
                      <td className="px-4 py-3 text-xs font-mono text-[#64748b]">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1d1d1f]">
                        {inv.name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                          {inv.school?.name ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(inv.email)}
                          className="rounded-lg border border-[#fecaca] px-2.5 py-1 text-xs text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <AddUserModal
          schools={schools}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ------- Add User Modal -------

function AddUserModal({
  schools,
  onClose,
  onSuccess,
}: {
  schools: School[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState("coordinator");
  const [allowedSeries, setAllowedSeries] = useState<string[]>(["3º Ano"]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const seriesOptions = ["1º Ano", "2º Ano", "3º Ano"];

  function toggleSeries(s: string) {
    setAllowedSeries((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === "coordinator" && !schoolId) {
      setResult({ success: false, message: "Selecione uma escola para coordenadores" });
      return;
    }
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.rpc("add_project_user", {
      p_email: email,
      p_school_id: schoolId || null,
      p_name: name || null,
      p_role: role,
      p_allowed_series: allowedSeries,
    });

    if (error) {
      setResult({ success: false, message: error.message });
      setSubmitting(false);
      return;
    }

    const res = data as { success: boolean; message: string };
    setResult({ success: res.success, message: res.message });
    setSubmitting(false);

    if (res.success) {
      const selectedSchool = schools.find((s) => s.id === schoolId);
      logAudit("add_coordinator", "coordinator", email, { schoolId, schoolName: selectedSchool?.name });
      setTimeout(onSuccess, 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            Adicionar ao Projeto
          </h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#1d1d1f] transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#374151]">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coordenador@escola.com"
              required
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <p className="text-xs text-[#94a3b8]">
              Se o usuario ja logou no sistema, tera acesso imediato. Senao, sera ativado no primeiro login.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#374151]">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do usuario"
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#374151]">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="coordinator">Coordenador</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#374151]">
              Escola {role === "coordinator" ? "*" : ""}
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required={role === "coordinator"}
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="">Selecione uma escola</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#374151]">
              Series permitidas
            </label>
            <div className="flex gap-4 py-1">
              {seriesOptions.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-sm text-[#1d1d1f] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={allowedSeries.includes(s)}
                    onChange={() => toggleSeries(s)}
                    className="h-4 w-4 accent-[#2563eb]"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {result && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                result.success
                  ? "border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
                  : "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm text-[#64748b] transition-colors hover:bg-[#f1f5f9]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Processando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
