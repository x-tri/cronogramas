/**
 * ResponsesDrawer — lista alunos que submeteram + TRI individual + totais.
 *
 * Fetch direto via supabase (RLS 016 ja filtra por escola do admin/coord).
 * Usa drawer lateral para ficar leve, sem full modal.
 */

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../../lib/supabase";

export interface ResponsesDrawerProps {
  readonly open: boolean;
  readonly simuladoId: string | null;
  readonly simuladoTitle: string;
  readonly onClose: () => void;
}

interface RespostaRow {
  readonly id: string;
  readonly student_id: string;
  readonly tri_lc: number | null;
  readonly tri_ch: number | null;
  readonly tri_cn: number | null;
  readonly tri_mt: number | null;
  readonly acertos_lc: number;
  readonly acertos_ch: number;
  readonly acertos_cn: number;
  readonly acertos_mt: number;
  readonly submitted_at: string;
  readonly students?: { name: string | null; turma: string | null } | null;
}

function avgOrDash(r: RespostaRow): string {
  const scores = [r.tri_lc, r.tri_ch, r.tri_cn, r.tri_mt].filter(
    (s): s is number => typeof s === "number",
  );
  if (scores.length === 0) return "—";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg.toFixed(0);
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? score.toFixed(0) : "—";
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ResponsesDrawer({
  open,
  simuladoId,
  simuladoTitle,
  onClose,
}: ResponsesDrawerProps) {
  const [respostas, setRespostas] = useState<ReadonlyArray<RespostaRow>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !simuladoId) return;
    let cancelled = false;

    supabase
      .from("simulado_respostas")
      .select(
        "id, student_id, tri_lc, tri_ch, tri_cn, tri_mt, acertos_lc, acertos_ch, acertos_cn, acertos_mt, submitted_at, students:student_id (name, turma)",
      )
      .eq("simulado_id", simuladoId)
      .order("submitted_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setRespostas([]);
        } else {
          setError(null);
          setRespostas((data ?? []) as unknown as RespostaRow[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, simuladoId]);

  const stats = useMemo(() => {
    if (respostas.length === 0) return null;
    const lc = respostas.map((r) => r.tri_lc).filter((x): x is number => x != null);
    const ch = respostas.map((r) => r.tri_ch).filter((x): x is number => x != null);
    const cn = respostas.map((r) => r.tri_cn).filter((x): x is number => x != null);
    const mt = respostas.map((r) => r.tri_mt).filter((x): x is number => x != null);
    const avg = (xs: number[]): string =>
      xs.length === 0 ? "—" : (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0);
    return { LC: avg(lc), CH: avg(ch), CN: avg(cn), MT: avg(mt) };
  }, [respostas]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Respostas do simulado ${simuladoTitle}`}
      className="fixed inset-0 z-40 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Respostas recebidas
            </h2>
            <p className="mt-0.5 text-xs text-[#71717a]">{simuladoTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-[#71717a] hover:bg-[#f4f4f5]"
          >
            ✕
          </button>
        </header>

        {/* Stats agregados */}
        {stats && (
          <section
            aria-label="TRI medio por area"
            className="border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#71717a]">
              TRI medio ({respostas.length}{" "}
              {respostas.length === 1 ? "aluno" : "alunos"})
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              {(["LC", "CH", "CN", "MT"] as const).map((area) => (
                <div
                  key={area}
                  className="rounded-md bg-white px-2 py-1.5 text-center"
                >
                  <div className="text-[10px] font-medium text-[#71717a]">
                    {area}
                  </div>
                  <div className="text-sm font-bold text-[#1d1d1f]">
                    {stats[area]}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <p className="text-sm text-[#71717a]">Carregando respostas...</p>
          )}

          {!loading && error && (
            <p
              role="alert"
              className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]"
            >
              {error}
            </p>
          )}

          {!loading && !error && respostas.length === 0 && (
            <p className="text-sm italic text-[#94a3b8]">
              Nenhum aluno respondeu ainda.
            </p>
          )}

          {!loading && !error && respostas.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
              <table className="w-full text-xs">
                <thead className="bg-[#f4f4f5] text-[#71717a]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Aluno</th>
                    <th className="px-3 py-2 text-left font-medium">Turma</th>
                    <th className="px-2 py-2 text-center font-medium">LC</th>
                    <th className="px-2 py-2 text-center font-medium">CH</th>
                    <th className="px-2 py-2 text-center font-medium">CN</th>
                    <th className="px-2 py-2 text-center font-medium">MT</th>
                    <th className="px-2 py-2 text-center font-medium">Média</th>
                    <th className="px-3 py-2 text-left font-medium">Enviou</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f4f5]">
                  {respostas.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium text-[#1d1d1f]">
                        {r.students?.name ?? "(sem nome)"}
                      </td>
                      <td className="px-3 py-2 text-[#71717a]">
                        {r.students?.turma ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {formatScore(r.tri_lc)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {formatScore(r.tri_ch)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {formatScore(r.tri_cn)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {formatScore(r.tri_mt)}
                      </td>
                      <td className="px-2 py-2 text-center font-bold">
                        {avgOrDash(r)}
                      </td>
                      <td className="px-3 py-2 text-[#71717a]">
                        {formatDateTime(r.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
