import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface School {
  id: string;
  name: string;
}

interface ScheduleEntry {
  id: string;
  school_id: string;
  turma: string;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
  turno: string;
  disciplina: string;
  professor: string | null;
  ano_letivo: number;
}

interface AdminHorariosProps {
  onBack: () => void;
}

const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
const DIA_LABELS: Record<string, string> = {
  segunda: "Seg",
  terca: "Ter",
  quarta: "Qua",
  quinta: "Qui",
  sexta: "Sex",
  sabado: "Sáb",
};

export function AdminHorarios({ onBack }: AdminHorariosProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [turmas, setTurmas] = useState<string[]>([]);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);

  // Load schools
  useEffect(() => {
    supabase.from("schools").select("id, name").order("name").then(({ data }) => {
      setSchools(data ?? []);
      if (data && data.length > 0) setSelectedSchool(data[0].id);
      setLoading(false);
    });
  }, []);

  // Load turmas when school changes
  useEffect(() => {
    if (!selectedSchool) return;
    supabase
      .from("school_schedules")
      .select("turma")
      .eq("school_id", selectedSchool)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((d) => d.turma))].sort();
        setTurmas(unique);
        setSelectedTurma(unique[0] ?? "");
      });
  }, [selectedSchool]);

  // Load entries when turma changes
  const loadEntries = useCallback(async () => {
    if (!selectedSchool || !selectedTurma) {
      setEntries([]);
      return;
    }
    const { data } = await supabase
      .from("school_schedules")
      .select("*")
      .eq("school_id", selectedSchool)
      .eq("turma", selectedTurma)
      .order("dia_semana")
      .order("horario_inicio");
    setEntries(data ?? []);
  }, [selectedSchool, selectedTurma]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Group entries by dia
  const byDia = DIAS.reduce(
    (acc, dia) => {
      acc[dia] = entries.filter((e) => e.dia_semana === dia);
      return acc;
    },
    {} as Record<string, ScheduleEntry[]>,
  );

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta aula?")) return;
    await supabase.from("school_schedules").delete().eq("id", id);
    loadEntries();
  }

  async function handleDuplicateTurma() {
    const newTurma = prompt("Nome da nova turma (ex: B, C, 3B):");
    if (!newTurma) return;

    // Copy all entries from current turma to new turma
    const newEntries = entries.map(({ id: _id, ...rest }) => ({
      ...rest,
      turma: newTurma,
    }));

    const { error } = await supabase.from("school_schedules").insert(newEntries);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    alert(`Turma ${newTurma} criada com ${newEntries.length} aulas copiadas de ${selectedTurma}`);
    // Reload turmas
    setSelectedSchool((prev) => prev); // trigger re-fetch
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
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
              <h1 className="text-sm font-medium text-[#1d1d1f]">Horarios de Aula</h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedTurma && (
                <button
                  onClick={handleDuplicateTurma}
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#f1f5f9]"
                >
                  Duplicar turma
                </button>
              )}
              <button
                onClick={() => { setEditingEntry(null); setShowAddModal(true); }}
                className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1d4ed8]"
              >
                + Adicionar aula
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748b]">Escola:</label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] min-w-[180px]"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748b]">Turma:</label>
            <div className="flex gap-1">
              {turmas.length === 0 ? (
                <span className="text-xs text-[#94a3b8]">Nenhuma turma cadastrada</span>
              ) : (
                turmas.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTurma(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedTurma === t
                        ? "bg-[#2563eb] text-white"
                        : "bg-white border border-[#e5e7eb] text-[#64748b] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    {t}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="text-xs text-[#94a3b8]">
            {entries.length} aulas cadastradas
          </div>
        </div>

        {/* Schedule Grid */}
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-16 text-center">
            <p className="text-sm text-[#94a3b8]">Nenhum horario cadastrado para esta turma</p>
            <button
              onClick={() => { setEditingEntry(null); setShowAddModal(true); }}
              className="mt-4 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white"
            >
              Cadastrar primeiro horario
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DIAS.map((dia) => {
              const diaEntries = byDia[dia] ?? [];
              if (diaEntries.length === 0) return null;
              return (
                <div key={dia} className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e5e7eb]">
                    <h3 className="text-xs font-semibold text-[#374151] uppercase tracking-wider">
                      {DIA_LABELS[dia]}
                    </h3>
                  </div>
                  <div className="divide-y divide-[#f1f5f9]">
                    {diaEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="px-4 py-2 flex items-center gap-3 hover:bg-[#fafafa] group cursor-pointer"
                        onClick={() => { setEditingEntry(entry); setShowAddModal(true); }}
                      >
                        <div className="text-[10px] font-mono text-[#94a3b8] w-[72px] flex-shrink-0">
                          {entry.horario_inicio}-{entry.horario_fim}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#1d1d1f] truncate">
                            {entry.disciplina}
                          </p>
                          {entry.professor && (
                            <p className="text-[10px] text-[#94a3b8] truncate">
                              {entry.professor}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          entry.turno === "manha"
                            ? "bg-[#fef3c7] text-[#92400e]"
                            : entry.turno === "tarde"
                              ? "bg-[#dbeafe] text-[#1d4ed8]"
                              : "bg-[#ede9fe] text-[#6d28d9]"
                        }`}>
                          {entry.turno === "manha" ? "M" : entry.turno === "tarde" ? "T" : "N"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="opacity-0 group-hover:opacity-100 text-[#dc2626] hover:bg-[#fef2f2] rounded p-1 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ScheduleFormModal
          entry={editingEntry}
          schoolId={selectedSchool}
          turma={selectedTurma}
          onClose={() => { setShowAddModal(false); setEditingEntry(null); }}
          onSaved={() => { setShowAddModal(false); setEditingEntry(null); loadEntries(); }}
        />
      )}
    </div>
  );
}

// ---- Form Modal ----

function ScheduleFormModal({
  entry,
  schoolId,
  turma,
  onClose,
  onSaved,
}: {
  entry: ScheduleEntry | null;
  schoolId: string;
  turma: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  const [form, setForm] = useState({
    turma: entry?.turma ?? turma ?? "",
    dia_semana: entry?.dia_semana ?? "segunda",
    horario_inicio: entry?.horario_inicio ?? "07:30",
    horario_fim: entry?.horario_fim ?? "08:20",
    turno: entry?.turno ?? "manha",
    disciplina: entry?.disciplina ?? "",
    professor: entry?.professor ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.disciplina.trim()) {
      setError("Disciplina obrigatoria");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      school_id: schoolId,
      turma: form.turma,
      dia_semana: form.dia_semana,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      turno: form.turno,
      disciplina: form.disciplina.trim(),
      professor: form.professor.trim() || null,
    };

    if (isEdit && entry) {
      const { error: err } = await supabase
        .from("school_schedules")
        .update(payload)
        .eq("id", entry.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("school_schedules")
        .insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            {isEdit ? "Editar Aula" : "Nova Aula"}
          </h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#1d1d1f] text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Turma">
              <input value={form.turma} onChange={(e) => update("turma", e.target.value)} required className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]" />
            </Field>
            <Field label="Dia">
              <select value={form.dia_semana} onChange={(e) => update("dia_semana", e.target.value)} className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]">
                {DIAS.map((d) => <option key={d} value={d}>{DIA_LABELS[d]}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Inicio">
              <input type="time" value={form.horario_inicio} onChange={(e) => update("horario_inicio", e.target.value)} required className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]" />
            </Field>
            <Field label="Fim">
              <input type="time" value={form.horario_fim} onChange={(e) => update("horario_fim", e.target.value)} required className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]" />
            </Field>
            <Field label="Turno">
              <select value={form.turno} onChange={(e) => update("turno", e.target.value)} className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]">
                <option value="manha">Manha</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
            </Field>
          </div>

          <Field label="Disciplina *">
            <input value={form.disciplina} onChange={(e) => update("disciplina", e.target.value)} required placeholder="Ex: Matemática 1" className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]" />
          </Field>

          <Field label="Professor">
            <input value={form.professor} onChange={(e) => update("professor", e.target.value)} placeholder="Ex: João Silva" className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]" />
          </Field>

          {error && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm text-[#64748b] hover:bg-[#f1f5f9]">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-60">
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#374151]">{label}</label>
      {children}
    </div>
  );
}
