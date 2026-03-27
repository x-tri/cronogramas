import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { deletePdf, deleteAllSchoolPdfs } from "../../services/pdf-storage";

interface School {
  id: string;
  name: string;
}

interface PdfRecord {
  id: string;
  school_id: string;
  aluno_id: string;
  aluno_nome: string;
  turma: string | null;
  matricula: string | null;
  tipo: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  created_at: string;
  school?: School | null;
}

interface AdminPdfsProps {
  onBack: () => void;
}

const BUCKET_URL_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/cronogramas-pdf`;

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPdfs({ onBack }: AdminPdfsProps) {
  const [records, setRecords] = useState<PdfRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [pdfsRes, schoolsRes] = await Promise.all([
      supabase
        .from("pdf_history")
        .select("*, school:schools(id, name)")
        .order("created_at", { ascending: false }),
      supabase.from("schools").select("id, name").order("name"),
    ]);
    setRecords(pdfsRes.data ?? []);
    setSchools(schoolsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const turmas = [...new Set(records.map((r) => r.turma).filter(Boolean))].sort() as string[];

  let filtered = records;
  if (selectedSchool) filtered = filtered.filter((r) => r.school_id === selectedSchool);
  if (filterTurma) filtered = filtered.filter((r) => r.turma === filterTurma);

  const totalSize = filtered.reduce((sum, r) => sum + (r.file_size ?? 0), 0);

  async function handleDelete(record: PdfRecord) {
    if (!confirm(`Apagar PDF de ${record.aluno_nome}?`)) return;
    setDeleting(true);
    await deletePdf(record.id, record.storage_path);
    await loadData();
    setDeleting(false);
  }

  async function handleDeleteAll() {
    const schoolName = selectedSchool
      ? schools.find((s) => s.id === selectedSchool)?.name ?? "escola"
      : "TODAS as escolas";
    const count = filtered.length;

    if (!confirm(`Apagar TODOS os ${count} PDFs de ${schoolName}?\n\nEssa acao nao pode ser desfeita.`)) return;
    if (!confirm(`Tem certeza? ${count} PDFs serao removidos permanentemente.`)) return;

    setDeleting(true);

    if (selectedSchool) {
      await deleteAllSchoolPdfs(selectedSchool);
    } else {
      // Delete all schools
      const schoolIds = [...new Set(filtered.map((r) => r.school_id))];
      for (const sid of schoolIds) {
        await deleteAllSchoolPdfs(sid);
      }
    }

    await loadData();
    setDeleting(false);
  }

  function copyLink(storagePath: string) {
    const url = `${BUCKET_URL_BASE}/${storagePath}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado!");
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
              <h1 className="text-sm font-medium text-[#1d1d1f]">Historico de PDFs</h1>
            </div>
            {filtered.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="rounded-lg bg-[#dc2626] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {deleting ? "Apagando..." : "Apagar todos"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{records.length}</p>
            <p className="text-xs text-[#64748b]">PDFs gerados</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">{formatFileSize(totalSize)}</p>
            <p className="text-xs text-[#64748b]">Espaco ocupado</p>
          </div>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">
              {[...new Set(records.map((r) => r.aluno_id))].length}
            </p>
            <p className="text-xs text-[#64748b]">Alunos atendidos</p>
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
          <span className="text-xs text-[#94a3b8]">{filtered.length} PDFs</span>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Aluno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Turma</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">Matricula</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden lg:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hidden md:table-cell">Tamanho</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Data</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-[#94a3b8]">
                    Nenhum PDF gerado ainda
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#f1f5f9] hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-[#1d1d1f]">{r.aluno_nome}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">
                        {r.turma ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#64748b] hidden md:table-cell">{r.matricula ?? "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748b] hidden lg:table-cell capitalize">{r.tipo.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-xs text-[#94a3b8] hidden md:table-cell">{formatFileSize(r.file_size)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#94a3b8]">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Download */}
                        <a
                          href={`${BUCKET_URL_BASE}/${r.storage_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1.5 text-[#2563eb] hover:bg-[#dbeafe] transition-colors"
                          title="Baixar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                        {/* Copy link */}
                        <button
                          onClick={() => copyLink(r.storage_path)}
                          className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
                          title="Copiar link"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={deleting}
                          className="rounded p-1.5 text-[#dc2626] hover:bg-[#fef2f2] transition-colors disabled:opacity-50"
                          title="Apagar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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
