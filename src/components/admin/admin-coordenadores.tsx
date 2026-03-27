import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface School {
  id: string;
  name: string;
  slug: string;
}

interface CoordinatorProfile {
  id: string;
  school_id: string | null;
  role: string;
  name: string;
  email: string;
  allowed_series: string[] | null;
  created_at: string;
  school: School | null;
}

interface CoordinatorInvite {
  id: string;
  email: string;
  name: string | null;
  school_id: string;
  allowed_series: string[];
  status: string;
  created_at: string;
  expires_at: string;
  school: School | null;
}

interface AdminCoordinadoresProps {
  onBack: () => void;
}

export function AdminCoordinadores({ onBack }: AdminCoordinadoresProps) {
  const [coordinators, setCoordinators] = useState<CoordinatorProfile[]>([]);
  const [invites, setInvites] = useState<CoordinatorInvite[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterSchool, setFilterSchool] = useState("");

  const loadData = useCallback(async () => {
    const [coordRes, invitesRes, schoolsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, school:schools(id, name, slug)")
        .eq("role", "school_admin")
        .order("name"),
      supabase
        .from("coordinator_invites")
        .select("*, school:schools(id, name, slug)")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("schools").select("*").order("name"),
    ]);

    setCoordinators(coordRes.data ?? []);
    setInvites(invitesRes.data ?? []);
    setSchools(schoolsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = filterSchool
    ? coordinators.filter((c) => c.school_id === filterSchool)
    : coordinators;

  const filteredInvites = filterSchool
    ? invites.filter((i) => i.school_id === filterSchool)
    : invites;

  async function handleRemove(email: string) {
    if (!confirm(`Remover ${email} como coordenador?`)) return;
    const { data, error } = await supabase.rpc("remove_coordinator", {
      p_email: email,
    });
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    alert(String(data));
    loadData();
  }

  async function handleCancelInvite(id: string) {
    if (!confirm("Cancelar este convite?")) return;
    const { error } = await supabase
      .from("coordinator_invites")
      .update({ status: "expired" })
      .eq("id", id);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    loadData();
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071e3] border-t-transparent" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-[#0071e3] hover:text-[#0077ED] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>
              <div className="h-4 w-px bg-[#e3e2e0]" />
              <h1 className="text-base font-medium text-[#37352f]">
                Gestao de Coordenadores
              </h1>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-xl bg-[#0071e3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
            >
              + Adicionar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="rounded-2xl border border-[#d7d7dc] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{coordinators.length}</p>
            <p className="text-sm text-[#86868b]">Coordenadores ativos</p>
          </div>
          <div className="rounded-2xl border border-[#d7d7dc] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{invites.length}</p>
            <p className="text-sm text-[#86868b]">Convites pendentes</p>
          </div>
          <div className="rounded-2xl border border-[#d7d7dc] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{schools.length}</p>
            <p className="text-sm text-[#86868b]">Escolas</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label htmlFor="schoolFilter" className="text-sm text-[#6b6b67]">
            Filtrar por escola:
          </label>
          <select
            id="schoolFilter"
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className="rounded-xl border border-[#d3d3d8] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe] min-w-[200px]"
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
        <div className="rounded-2xl border border-[#d7d7dc] bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e3e2e0] bg-[#fafafa]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                  Escola
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67] hidden md:table-cell">
                  Series
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#a1a1a6]">
                    Nenhum coordenador encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[#f1f1ef] hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[#1d1d1f]">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6b6b67] font-mono">
                      {c.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-medium text-[#1d4ed8]">
                        {c.school?.name ?? "Sem escola"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6b6b67] hidden md:table-cell">
                      {c.allowed_series?.join(", ") ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(c.email)}
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
            <h2 className="text-lg font-semibold text-[#1d1d1f] mt-8">
              Convites Pendentes
            </h2>
            <div className="rounded-2xl border border-[#d7d7dc] bg-white overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e3e2e0] bg-[#fafafa]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                      Escola
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                      Expira
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#6b6b67]">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvites.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#f1f1ef] hover:bg-[#fafafa]">
                      <td className="px-4 py-3 text-xs font-mono text-[#6b6b67]">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                          {inv.school?.name ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1a6]">
                        {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
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
        <AddCoordinatorModal
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

// ------- Add Coordinator Modal -------

function AddCoordinatorModal({
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
    if (!schoolId) {
      setResult({ success: false, message: "Selecione uma escola" });
      return;
    }
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.rpc("create_coordinator_invite", {
      p_email: email,
      p_school_id: schoolId,
      p_name: name || null,
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
      setTimeout(onSuccess, 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[#d7d7dc] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e3e2e0] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            Adicionar Coordenador
          </h2>
          <button
            onClick={onClose}
            className="text-[#a1a1a6] hover:text-[#1d1d1f] transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#37352f]">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coordenador@escola.com"
              required
              className="w-full rounded-xl border border-[#d3d3d8] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <p className="text-xs text-[#a1a1a6]">
              Se ja existe no sistema, sera promovido. Senao, um convite sera
              criado.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#37352f]">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do coordenador"
              className="w-full rounded-xl border border-[#d3d3d8] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#37352f]">
              Escola *
            </label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
              className="w-full rounded-xl border border-[#d3d3d8] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="">Selecione uma escola</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#37352f]">
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
                    className="h-4 w-4 accent-[#0071e3]"
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
              className="rounded-xl border border-[#d3d3d8] px-4 py-2 text-sm text-[#6b6b67] transition-colors hover:bg-[#f1f1ef]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#0071e3] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Processando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
