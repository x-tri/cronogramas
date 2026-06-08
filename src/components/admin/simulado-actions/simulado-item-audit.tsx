import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../../lib/supabase";
import {
  auditSummary,
  runAndPersistItemAudit,
  type ItemAuditClassification,
  type ItemAuditResult,
} from "../../../services/simulado/item-audit";

interface SimuladoItemAuditProps {
  readonly open: boolean;
  readonly simuladoId: string | null;
  readonly simuladoTitle: string;
  readonly onClose: () => void;
}

interface PersistedAuditRow {
  readonly simulado_id: string;
  readonly item_id: string;
  readonly numero: number;
  readonly area: "LC" | "CH" | "CN" | "MT";
  readonly gabarito: string;
  readonly dificuldade_original: number;
  readonly n_respostas: number;
  readonly n_respondidas: number;
  readonly n_acertos: number;
  readonly n_brancos: number;
  readonly taxa_acerto: number | string | null;
  readonly erro_padrao_taxa: number | string | null;
  readonly alternativa_mais_marcada: string | null;
  readonly alternativa_mais_marcada_pct: number | string | null;
  readonly alternativas: Record<string, number>;
  readonly discriminacao_proxy: number | string | null;
  readonly classifications: readonly ItemAuditClassification[];
  readonly review_status: "sinal_de_revisao";
  readonly recalculo_bloqueado: true;
  readonly audit_version: string;
  readonly audited_at: string;
}

interface IntegrityState {
  readonly n_respostas: number;
  readonly invalid_answers_total: number;
  readonly respostas_com_mismatch: number;
  readonly mismatch_lc: number;
  readonly mismatch_ch: number;
  readonly mismatch_cn: number;
  readonly mismatch_mt: number;
}

const CLASSIFICATION_LABELS: Record<ItemAuditClassification, string> = {
  confiavel_operacionalmente: "Confiável operacionalmente",
  gabarito_provavel_errado: "Gabarito provável errado",
  sinal_revisao_gabarito: "Revisar gabarito/distrator",
  sinal_revisao_dificuldade: "Revisar dificuldade",
  sinal_revisao_discriminacao: "Revisar discriminação",
  amostra_insuficiente: "Amostra insuficiente",
  bloqueado_para_recalculo: "Recalculo bloqueado",
};

const PRIORITY: readonly ItemAuditClassification[] = [
  "gabarito_provavel_errado",
  "sinal_revisao_gabarito",
  "sinal_revisao_discriminacao",
  "sinal_revisao_dificuldade",
  "amostra_insuficiente",
  "bloqueado_para_recalculo",
  "confiavel_operacionalmente",
];

// Classificações que são sinal de revisão (mostradas como badge na linha).
// As demais (confiável / recálculo bloqueado / amostra insuficiente) são estados
// constantes e ficam fora das linhas para reduzir ruído.
const REVIEW_CLASSIFICATIONS: ReadonlySet<ItemAuditClassification> = new Set([
  "gabarito_provavel_errado",
  "sinal_revisao_gabarito",
  "sinal_revisao_discriminacao",
  "sinal_revisao_dificuldade",
]);

function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePersisted(row: PersistedAuditRow): ItemAuditResult {
  return {
    simulado_id: row.simulado_id,
    item_id: row.item_id,
    numero: row.numero,
    area: row.area,
    gabarito: row.gabarito,
    dificuldade_original: row.dificuldade_original,
    n_respostas: row.n_respostas,
    n_respondidas: row.n_respondidas,
    n_acertos: row.n_acertos,
    n_brancos: row.n_brancos,
    taxa_acerto: toNum(row.taxa_acerto),
    erro_padrao_taxa: toNum(row.erro_padrao_taxa),
    alternativa_mais_marcada: row.alternativa_mais_marcada,
    alternativa_mais_marcada_pct: toNum(row.alternativa_mais_marcada_pct),
    alternativas: row.alternativas ?? {},
    discriminacao_proxy: toNum(row.discriminacao_proxy),
    classifications: row.classifications,
    review_status: row.review_status,
    recalculo_bloqueado: row.recalculo_bloqueado,
    audit_version: row.audit_version,
  };
}

function formatPct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function formatNum(v: number | null): string {
  return v == null ? "—" : v.toFixed(3);
}

function hasAnySignal(audit: ItemAuditResult): boolean {
  return audit.classifications.some((c) => REVIEW_CLASSIFICATIONS.has(c));
}

export function SimuladoItemAudit({
  open,
  simuladoId,
  simuladoTitle,
  onClose,
}: SimuladoItemAuditProps) {
  const [audits, setAudits] = useState<readonly ItemAuditResult[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityState | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlySignals, setShowOnlySignals] = useState(true);

  useEffect(() => {
    if (!open || !simuladoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIntegrity(null);

    supabase
      .from("simulado_item_audits")
      .select("*")
      .eq("simulado_id", simuladoId)
      .order("numero", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setAudits([]);
        } else {
          setAudits(((data ?? []) as PersistedAuditRow[]).map(normalizePersisted));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, simuladoId]);

  const summary = useMemo(() => auditSummary(audits), [audits]);
  const filteredAudits = useMemo(() => {
    const base = showOnlySignals ? audits.filter(hasAnySignal) : audits;
    return [...base].sort((a, b) => {
      const aPriority = PRIORITY.findIndex((c) => a.classifications.includes(c));
      const bPriority = PRIORITY.findIndex((c) => b.classifications.includes(c));
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Mesmo nível: pior primeiro (discriminação mais baixa/negativa).
      const aDisc = a.discriminacao_proxy ?? Number.POSITIVE_INFINITY;
      const bDisc = b.discriminacao_proxy ?? Number.POSITIVE_INFINITY;
      if (aDisc !== bDisc) return aDisc - bDisc;
      return a.numero - b.numero;
    });
  }, [audits, showOnlySignals]);

  async function handleRunAudit(): Promise<void> {
    if (!simuladoId) return;
    setRunning(true);
    setError(null);
    try {
      const result = await runAndPersistItemAudit(supabase, simuladoId);
      setAudits(result.audits);
      setIntegrity(result.integrity);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Auditoria TRI de ${simuladoTitle}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#f5f5f7]"
    >
      <header className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] bg-white px-6 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
            Auditoria defensiva da TRI estimada
          </p>
          <h2 className="truncate text-base font-bold text-[#1d1d1f]">
            {simuladoTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOnlySignals((v) => !v)}
            className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f8fafc]"
          >
            {showOnlySignals ? "Ver todos" : "Só sinais"}
          </button>
          <button
            type="button"
            onClick={() => void handleRunAudit()}
            disabled={running || !simuladoId}
            className="rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {running ? "Auditando..." : "Rodar auditoria"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#71717a] hover:text-[#1d1d1f]"
          >
            Fechar
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-6xl space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]">
              {error}
            </div>
          )}

          {integrity && (
            <section className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-xs text-[#1e3a8a]">
              Integridade: {integrity.n_respostas} respostas, {integrity.invalid_answers_total} alternativas inválidas,
              {" "}{integrity.respostas_com_mismatch} respostas com divergência entre `answers` e totais salvos.
            </section>
          )}

          <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {PRIORITY.map((key) => {
              const critico = key === "gabarito_provavel_errado" && summary[key] > 0;
              return (
                <div
                  key={key}
                  className={`rounded-lg border bg-white p-3 ${
                    critico ? "border-[#fca5a5]" : "border-[#e5e7eb]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    {CLASSIFICATION_LABELS[key]}
                  </p>
                  <p className={`mt-1 text-2xl font-black ${critico ? "text-[#b91c1c]" : "text-[#1d1d1f]"}`}>
                    {summary[key]}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white">
            <div className="border-b border-[#f4f4f5] px-4 py-3">
              <h3 className="text-sm font-bold text-[#1d1d1f]">
                Itens em auditoria ({filteredAudits.length})
              </h3>
              <p className="mt-1 text-xs text-[#71717a]">
                A classificação é sinal de revisão. Recalculo fica bloqueado até validação humana.
              </p>
            </div>

            {loading ? (
              <p className="p-4 text-sm text-[#71717a]">Carregando auditoria...</p>
            ) : audits.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-[#1d1d1f]">Nenhuma auditoria persistida.</p>
                <p className="mt-1 text-xs text-[#71717a]">
                  Rode a auditoria para gerar agregados anônimos por item.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#fafafa] text-[#71717a]">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-center">Área</th>
                      <th className="px-2 py-2 text-center">Gab.</th>
                      <th className="px-2 py-2 text-center">Dif.</th>
                      <th className="px-2 py-2 text-center">N</th>
                      <th className="px-2 py-2 text-center">Acerto</th>
                      <th className="px-2 py-2 text-center">Top alt.</th>
                      <th className="px-2 py-2 text-center">Disc.</th>
                      <th className="px-3 py-2 text-left">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5]">
                    {filteredAudits.map((audit) => (
                      <tr key={`${audit.audit_version}-${audit.numero}`}>
                        <td className="px-3 py-2 font-bold text-[#1d1d1f]">{audit.numero}</td>
                        <td className="px-2 py-2 text-center">{audit.area}</td>
                        <td className="px-2 py-2 text-center font-mono">{audit.gabarito}</td>
                        <td className="px-2 py-2 text-center">{audit.dificuldade_original}</td>
                        <td className="px-2 py-2 text-center">{audit.n_respostas}</td>
                        <td className="px-2 py-2 text-center">{formatPct(audit.taxa_acerto)}</td>
                        <td className="px-2 py-2 text-center">
                          {audit.alternativa_mais_marcada ?? "—"}{" "}
                          <span className="text-[#94a3b8]">
                            {formatPct(audit.alternativa_mais_marcada_pct)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">{formatNum(audit.discriminacao_proxy)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const sinais = audit.classifications.filter((c) =>
                                REVIEW_CLASSIFICATIONS.has(c),
                              );
                              if (sinais.length === 0) {
                                return (
                                  <span className="text-[10px] text-[#94a3b8]">
                                    Confiável operacionalmente
                                  </span>
                                );
                              }
                              return sinais.map((c) => (
                                <span
                                  key={c}
                                  className={
                                    c === "gabarito_provavel_errado"
                                      ? "rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#b91c1c]"
                                      : "rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#334155]"
                                  }
                                >
                                  {CLASSIFICATION_LABELS[c]}
                                </span>
                              ));
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
