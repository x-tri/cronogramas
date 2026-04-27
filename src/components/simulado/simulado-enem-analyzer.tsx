/**
 * SimuladoEnemAnalyzer — componente complementar ao SimuladoAnalyzer legacy.
 *
 * Contexto: o SimuladoAnalyzer legacy (simulado-analyzer.tsx) le do banco
 * DEDICADO (simuladoSupabase) e mostra simulados antigos. Os NOVOS simulados
 * ENEM criados via wizard da Fase 3.2 vivem no banco PRIMARY, tabelas
 * simulados/simulado_respostas (migrations 015-018).
 *
 * Este componente:
 *   - Le simulado_respostas do aluno selecionado (student_id) no banco primary
 *   - Mostra dropdown com simulados respondidos + data
 *   - Ao selecionar, expande painel inline com TRI 4-areas + totais + top
 *     topicos errados
 *   - NAO interfere com o SimuladoAnalyzer legacy — renderiza ao lado
 *
 * Props:
 *   - studentId: uuid do aluno (currentStudent.id do cronograma-store)
 *   - variant: 'default' ou 'compact' (segue padrao do SimuladoAnalyzer legacy)
 */

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase";

interface SimuladoEnemAnalyzerProps {
  /** Matricula do aluno selecionado. O componente resolve o students.id
   *  internamente (currentStudent.id do store e a matricula, nao UUID). */
  readonly matricula: string;
  readonly variant?: "default" | "compact";
}

interface RespostaRow {
  readonly id: string;
  readonly simulado_id: string;
  readonly tri_lc: number | null;
  readonly tri_ch: number | null;
  readonly tri_cn: number | null;
  readonly tri_mt: number | null;
  readonly acertos_lc: number;
  readonly erros_lc: number;
  readonly branco_lc: number;
  readonly acertos_ch: number;
  readonly erros_ch: number;
  readonly branco_ch: number;
  readonly acertos_cn: number;
  readonly erros_cn: number;
  readonly branco_cn: number;
  readonly acertos_mt: number;
  readonly erros_mt: number;
  readonly branco_mt: number;
  // Suporta ambos formatos: legacy (number) e novo ({ area, n }).
  // Ver migration 027 e ranking-aggregations.unwrapErroValor.
  readonly erros_por_topico: Record<string, number | { area: string; n: number }>;
  readonly submitted_at: string;
  readonly simulados?: {
    readonly title: string;
    readonly published_at: string | null;
  } | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? score.toFixed(0) : "—";
}

function proficiencyColor(score: number | null): string {
  if (score == null) return "text-[#94a3b8]";
  if (score < 450) return "text-[#dc2626]";
  if (score < 550) return "text-[#ea580c]";
  if (score < 650) return "text-[#2563eb]";
  return "text-[#16a34a]";
}

function triToGaugePercent(score: number | null): number {
  if (score == null) return 0;
  const clamped = Math.max(200, Math.min(1000, score));
  return ((clamped - 200) / 800) * 100;
}

export function SimuladoEnemAnalyzer({
  matricula,
  variant = "default",
}: SimuladoEnemAnalyzerProps) {
  const [respostas, setRespostas] = useState<ReadonlyArray<RespostaRow>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  // Resolve UUID real do students.id a partir da matricula, depois busca
  // respostas. O store cronograma-store usa matricula como Aluno.id (legacy),
  // mas simulado_respostas.student_id e FK UUID p/ students.id — precisamos
  // fazer o lookup aqui pra nao quebrar queries de cronograma em outro lugar.
  useEffect(() => {
    if (!matricula) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data: studentRow, error: lookupErr } = await supabase
        .from("students")
        .select("id")
        .eq("matricula", matricula)
        .maybeSingle();

      if (cancelled) return;

      if (lookupErr) {
        setError(lookupErr.message);
        setRespostas([]);
        setLoading(false);
        return;
      }
      if (!studentRow?.id) {
        // Aluno avulso ou sem vinculo no banco primary — nao tem simulados
        // novos possiveis. Estado vazio legitimo, sem erro.
        setRespostas([]);
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("simulado_respostas")
        .select(
          "id, simulado_id, tri_lc, tri_ch, tri_cn, tri_mt, " +
            "acertos_lc, erros_lc, branco_lc, " +
            "acertos_ch, erros_ch, branco_ch, " +
            "acertos_cn, erros_cn, branco_cn, " +
            "acertos_mt, erros_mt, branco_mt, " +
            "erros_por_topico, submitted_at, " +
            "simulados:simulado_id (title, published_at)",
        )
        .eq("student_id", studentRow.id)
        .order("submitted_at", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setRespostas([]);
      } else {
        const rows = (data ?? []) as unknown as RespostaRow[];
        setRespostas(rows);
        if (rows.length > 0 && !selectedId) {
          setSelectedId(rows[0]!.id);
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // selectedId fora das deps para nao recarregar ao trocar selecao
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matricula]);

  const selected = useMemo<RespostaRow | null>(() => {
    if (!selectedId) return null;
    return respostas.find((r) => r.id === selectedId) ?? null;
  }, [respostas, selectedId]);

  const topTopicos = useMemo<ReadonlyArray<[string, number]>>(() => {
    if (!selected?.erros_por_topico) return [];
    // Aceita ambos formatos: legacy (number) e novo ({ area, n }).
    return Object.entries(selected.erros_por_topico)
      .map(([t, v]): [string, number] => [t, typeof v === "number" ? v : v.n])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [selected]);

  const totalAcertos = useMemo<number>(() => {
    if (!selected) return 0;
    return (
      selected.acertos_lc +
      selected.acertos_ch +
      selected.acertos_cn +
      selected.acertos_mt
    );
  }, [selected]);

  // --- Compact: botao pill que abre dropdown + panel inline -----------
  const compact = variant === "compact";
  const count = respostas.length;

  if (compact) {
    return (
      <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafbff]">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-label="Simulados ENEM respondidos pelo aluno"
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#f1f5ff]"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#2563eb]/10 text-[#2563eb]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M15 14l1.5 1.5L19 13" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Simulados ENEM
            </p>
            <p className="text-xs font-semibold text-[#1d1d1f]">
              {loading
                ? "Carregando..."
                : count === 0
                  ? "Nenhum respondido"
                  : `${count} respondido${count === 1 ? "" : "s"}`}
            </p>
          </div>
          {count > 0 && (
            <svg
              className={`h-4 w-4 text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        {open && (
          <SimuladoEnemPanel
            respostas={respostas}
            selected={selected}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            topTopicos={topTopicos}
            totalAcertos={totalAcertos}
            loading={loading}
            error={error}
          />
        )}
      </div>
    );
  }

  // --- Default: panel expandido ja aberto ------------------------------
  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">
        Simulados ENEM do aluno
      </h3>
      <SimuladoEnemPanel
        respostas={respostas}
        selected={selected}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        topTopicos={topTopicos}
        totalAcertos={totalAcertos}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel interno: select + TRI 4-areas + top topicos errados
// ---------------------------------------------------------------------------

interface PanelProps {
  readonly respostas: ReadonlyArray<RespostaRow>;
  readonly selected: RespostaRow | null;
  readonly selectedId: string | null;
  readonly setSelectedId: (id: string) => void;
  readonly topTopicos: ReadonlyArray<[string, number]>;
  readonly totalAcertos: number;
  readonly loading: boolean;
  readonly error: string | null;
}

function SimuladoEnemPanel({
  respostas,
  selected,
  selectedId,
  setSelectedId,
  topTopicos,
  totalAcertos,
  loading,
  error,
}: PanelProps) {
  if (loading) {
    return (
      <div className="border-t border-[#e5e7eb] px-3 py-3 text-xs text-[#64748b]">
        Carregando simulados do aluno...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="border-t border-[#e5e7eb] px-3 py-3 text-xs text-[#dc2626]"
      >
        Falha ao carregar: {error}
      </div>
    );
  }

  if (respostas.length === 0) {
    return (
      <div className="border-t border-[#e5e7eb] px-3 py-3 text-xs italic text-[#94a3b8]">
        Este aluno ainda nao respondeu nenhum simulado ENEM novo.
      </div>
    );
  }

  return (
    <div className="border-t border-[#e5e7eb] px-3 py-3 space-y-3">
      {/* Seletor */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="sim-enem-select"
          className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]"
        >
          Simulado:
        </label>
        <select
          id="sim-enem-select"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs"
        >
          {respostas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.simulados?.title ?? "(sem título)"} ·{" "}
              {formatDate(r.submitted_at)}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* 4 gauges TRI */}
          <div
            aria-label="Notas TRI por area"
            className="grid grid-cols-4 gap-1.5"
          >
            {(["LC", "CH", "CN", "MT"] as const).map((area) => {
              const score =
                area === "LC"
                  ? selected.tri_lc
                  : area === "CH"
                    ? selected.tri_ch
                    : area === "CN"
                      ? selected.tri_cn
                      : selected.tri_mt;
              const acertos =
                area === "LC"
                  ? selected.acertos_lc
                  : area === "CH"
                    ? selected.acertos_ch
                    : area === "CN"
                      ? selected.acertos_cn
                      : selected.acertos_mt;
              const pct = triToGaugePercent(score);
              return (
                <div
                  key={area}
                  className="rounded-lg bg-[#f9fafb] px-2 py-1.5"
                >
                  <p className="text-[9px] font-bold uppercase text-[#94a3b8]">
                    {area}
                  </p>
                  <p
                    className={`text-base font-black ${proficiencyColor(score)}`}
                  >
                    {formatScore(score)}
                  </p>
                  <p className="text-[9px] text-[#71717a]">{acertos}/45</p>
                  <div className="mt-1 h-1 rounded-full bg-[#e5e7eb] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#dc2626] via-[#eab308] to-[#16a34a]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totais + data */}
          <div className="flex items-center justify-between rounded-lg bg-[#f9fafb] px-3 py-2 text-xs">
            <div>
              <p className="text-[10px] text-[#94a3b8]">Total de acertos</p>
              <p className="text-sm font-bold text-[#1d1d1f]">
                {totalAcertos}/180
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#94a3b8]">Submetido</p>
              <p className="text-xs font-semibold text-[#1d1d1f]">
                {formatDate(selected.submitted_at)}
              </p>
            </div>
          </div>

          {/* Top topicos errados */}
          {topTopicos.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                Onde mais errou (top 5)
              </p>
              <ul className="space-y-1.5">
                {topTopicos.map(([topico, count]) => {
                  const max = topTopicos[0]![1];
                  const pct = (count / max) * 100;
                  return (
                    <li key={topico}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="truncate font-medium text-[#1d1d1f]">
                          {topico}
                        </span>
                        <span className="ml-2 font-bold text-[#dc2626]">
                          {count}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-[#e5e7eb] overflow-hidden">
                        <div
                          className="h-full bg-[#f87171]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {topTopicos.length === 0 && (
            <p className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-[11px] font-semibold text-[#166534]">
              Sem erros nesse simulado — todos os itens respondidos foram
              acertos ou branco.
            </p>
          )}
        </>
      )}
    </div>
  );
}
