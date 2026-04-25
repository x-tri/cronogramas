import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { deletePdf, deleteAllSchoolPdfs, getSignedPdfUrl } from "../../services/pdf-storage";

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
  // Vindos de pdf_history_with_status (migration 025)
  download_count: number;
  first_downloaded_at: string | null;
  last_downloaded_at: string | null;
}

type StatusFilter = "all" | "downloaded" | "not_downloaded";

interface AdminPdfsProps {
  onBack: () => void;
  embedded?: boolean;
  userRole?: string | null;
  userSchoolId?: string | null;
}

const PDF_TYPE_LABELS: Readonly<Record<string, string>> = {
  cronograma: "Cronograma semanal",
  relatorio: "Relatório de desempenho",
  caderno_questoes: "Caderno de questões",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPdfs({ onBack, embedded, userRole, userSchoolId }: AdminPdfsProps) {
  const isCoordinator = userRole === "coordinator" && !!userSchoolId;
  const [records, setRecords] = useState<PdfRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState(isCoordinator ? userSchoolId! : "");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    // pdf_history_with_status (view criada em 025) traz download_count
    // + first/last_downloaded_at agregados — evita N+1 na hora de calcular
    // status por linha. Herda RLS de pdf_history + pdf_download_log.
    let pdfsQuery = supabase
      .from("pdf_history_with_status")
      .select("*")
      .order("created_at", { ascending: false });

    if (isCoordinator) {
      pdfsQuery = pdfsQuery.eq("school_id", userSchoolId!);
    }

    const [pdfsRes, schoolsRes] = await Promise.all([
      pdfsQuery,
      supabase.from("schools").select("id, name").order("name"),
    ]);
    setRecords(pdfsRes.data ?? []);
    setSchools(schoolsRes.data ?? []);
    setLoading(false);
  }, [isCoordinator, userSchoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const turmas = [...new Set(records.map((r) => r.turma).filter(Boolean))].sort() as string[];

  let filtered = records;
  if (selectedSchool) filtered = filtered.filter((r) => r.school_id === selectedSchool);
  if (filterTurma) filtered = filtered.filter((r) => r.turma === filterTurma);
  if (filterStatus === "downloaded") filtered = filtered.filter((r) => r.download_count > 0);
  if (filterStatus === "not_downloaded") filtered = filtered.filter((r) => r.download_count === 0);

  const totalSize = filtered.reduce((sum, r) => sum + (r.file_size ?? 0), 0);
  const downloadedCount = filtered.filter((r) => r.download_count > 0).length;

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

  async function copyLink(storagePath: string) {
    const url = await getSignedPdfUrl(storagePath);
    if (!url) {
      alert("Não foi possível gerar o link. Verifique permissões no bucket.");
      return;
    }
    await navigator.clipboard.writeText(url);
    alert("Link copiado! (válido por 1 hora)");
  }

  async function openPdf(storagePath: string) {
    const url = await getSignedPdfUrl(storagePath);
    if (!url) {
      alert("Não foi possível abrir o PDF. Verifique permissões no bucket.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
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
                <h1 className="text-sm font-medium text-[#1d1d1f]">PDFs e entregas</h1>
              </div>
              {filtered.length > 0 && !isCoordinator && (
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
      )}

      <main className={embedded ? "px-6 py-4 space-y-6" : "mx-auto max-w-6xl px-6 py-6 space-y-4"}>
        {/* Stats */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
            Histórico de PDFs
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d1d1f]">
            O que já foi gerado e ficou salvo no storage
          </h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Esta tela mostra apenas PDFs registrados pelo app no Supabase Storage:
            cronograma semanal, relatório de desempenho e caderno de questões.
          </p>
        </div>

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
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 flex-1">
            <p className="text-2xl font-semibold text-[#1d1d1f]">
              {downloadedCount}<span className="text-sm font-normal text-[#94a3b8]"> / {filtered.length}</span>
            </p>
            <p className="text-xs text-[#64748b]">Baixaram</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          {!isCoordinator && (
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
            <label className="text-xs text-[#64748b]">Baixou?</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#1d1d1f]"
            >
              <option value="all">Todos</option>
              <option value="downloaded">Baixaram</option>
              <option value="not_downloaded">Nao baixaram</option>
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">Baixou?</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#64748b]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="mx-auto max-w-xl space-y-2">
                      <p className="text-sm font-medium text-[#1d1d1f]">
                        Nenhum PDF registrado ainda
                      </p>
                      <p className="text-sm text-[#94a3b8]">
                        Os registros começam a aparecer aqui quando o mentor baixa um cronograma,
                        relatório ou caderno de questões pelo próprio app.
                      </p>
                    </div>
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
                    <td className="px-4 py-2.5 text-xs text-[#64748b] hidden lg:table-cell">
                      {PDF_TYPE_LABELS[r.tipo] ?? r.tipo.replace("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#94a3b8] hidden md:table-cell">{formatFileSize(r.file_size)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#94a3b8]">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.download_count > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#166534]"
                          title={`Baixou em ${r.first_downloaded_at ? new Date(r.first_downloaded_at).toLocaleString("pt-BR") : "-"}`}
                        >
                          ✓ Baixou
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-medium text-[#9a3412]">
                          Nao baixou
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Download */}
                        <button
                          onClick={() => openPdf(r.storage_path)}
                          className="rounded p-1.5 text-[#2563eb] hover:bg-[#dbeafe] transition-colors"
                          title="Baixar (link temporário)"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        {/* Copy link */}
                        <button
                          onClick={() => void copyLink(r.storage_path)}
                          className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
                          title="Copiar link (válido por 1 hora)"
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
