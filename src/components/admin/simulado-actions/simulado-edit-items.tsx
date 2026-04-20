/**
 * SimuladoEditItems — dialog para editar itens de um simulado em rascunho.
 *
 * Permite ao coordenador/super_admin corrigir gabarito, dificuldade e tópico
 * de qualquer item sem precisar recriar o simulado inteiro.
 *
 * Fluxo:
 *   1. Abre e busca os 180 itens do simulado (simulado_itens WHERE simulado_id).
 *   2. Exibe tabela paginada (20 itens/pág) com filtro por número.
 *   3. Edição inline em cada linha — mudanças ficam em memória (dirty set).
 *   4. "Salvar X alterações" faz UPDATE individual por item modificado.
 */

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface ItemRow {
  readonly id: string;
  readonly numero: number;
  readonly area: string;
  gabarito: string;
  dificuldade: number;
  topico: string;
}

interface SimuladoEditItemsProps {
  readonly open: boolean;
  readonly simuladoId: string | null;
  readonly simuladoTitle: string;
  readonly onClose: () => void;
}

const GABARITOSOPTIONS = ["A", "B", "C", "D", "E"] as const;
const PAGE_SIZE = 20;

const AREA_COLORS: Record<string, string> = {
  LC: "bg-blue-50 text-blue-700",
  CH: "bg-orange-50 text-orange-700",
  CN: "bg-emerald-50 text-emerald-700",
  MT: "bg-purple-50 text-purple-700",
};

export function SimuladoEditItems({
  open,
  simuladoId,
  simuladoTitle,
  onClose,
}: SimuladoEditItemsProps) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterNum, setFilterNum] = useState("");
  const [page, setPage] = useState(0);

  // Carrega itens ao abrir
  useEffect(() => {
    if (!open || !simuladoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDirty(new Set());
    setFilterNum("");
    setPage(0);

    supabase
      .from("simulado_itens")
      .select("id, numero, area, gabarito, dificuldade, topico")
      .eq("simulado_id", simuladoId)
      .order("numero")
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) {
          setError(e.message);
          setLoading(false);
          return;
        }
        setItems(
          (data ?? []).map((r) => ({
            id: r.id as string,
            numero: r.numero as number,
            area: r.area as string,
            gabarito: r.gabarito as string,
            dificuldade: r.dificuldade as number,
            topico: (r.topico as string | null) ?? "",
          })),
        );
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, simuladoId]);

  if (!open) return null;

  // --- filtragem e paginação ---
  const filtered = filterNum.trim()
    ? items.filter((it) => String(it.numero).includes(filterNum.trim()))
    : items;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const updateItem = (id: string, field: "gabarito" | "dificuldade" | "topico", value: string | number): void => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, [field]: value } : it,
      ),
    );
    setDirty((prev) => new Set(prev).add(id));
  };

  const handleSave = async (): Promise<void> => {
    if (dirty.size === 0) return;
    setSaving(true);
    setSaveError(null);

    const toSave = items.filter((it) => dirty.has(it.id));

    for (const item of toSave) {
      const { error: e } = await supabase
        .from("simulado_itens")
        .update({
          gabarito: item.gabarito,
          dificuldade: item.dificuldade,
          topico: item.topico.trim() || null,
        })
        .eq("id", item.id);

      if (e) {
        setSaving(false);
        setSaveError(`Erro no item ${item.numero}: ${e.message}`);
        return;
      }
    }

    setSaving(false);
    setDirty(new Set());
  };

  const handleClose = (): void => {
    setItems([]);
    setDirty(new Set());
    setError(null);
    setSaveError(null);
    onClose();
  };

  const dirtyCount = dirty.size;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar itens do simulado"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">Editar itens</h2>
            <p className="text-xs text-[#71717a] mt-0.5 truncate max-w-sm">{simuladoTitle}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="rounded p-1 text-[#71717a] hover:bg-[#f4f4f5]"
          >
            ✕
          </button>
        </header>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-3 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={180}
            value={filterNum}
            onChange={(e) => { setFilterNum(e.target.value); setPage(0); }}
            placeholder="Filtrar por nº (ex: 47)"
            className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm text-[#1d1d1f] w-44 focus:border-[#2563eb] focus:outline-none"
          />
          {filterNum && (
            <button
              type="button"
              onClick={() => { setFilterNum(""); setPage(0); }}
              className="text-xs text-[#71717a] hover:text-[#1d1d1f]"
            >
              Limpar filtro
            </button>
          )}
          <span className="ml-auto text-xs text-[#71717a]">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            {dirtyCount > 0 && (
              <span className="ml-2 font-semibold text-[#2563eb]">
                · {dirtyCount} alteração{dirtyCount !== 1 ? "ões" : ""} pendente{dirtyCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-[#71717a]">Carregando itens...</span>
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#71717a]">
              {filterNum ? "Nenhum item com esse número." : "Nenhum item cadastrado."}
            </p>
          )}

          {!loading && !error && pageItems.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold text-[#71717a] w-14">Nº</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-[#71717a] w-16">Área</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-[#71717a] w-28">Gabarito</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-[#71717a] w-24">Dificuldade</th>
                  <th className="pb-2 text-xs font-semibold text-[#71717a]">Tópico</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const isDirty = dirty.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-[#f4f4f5] transition-colors ${isDirty ? "bg-[#eff6ff]" : "hover:bg-[#f9fafb]"}`}
                    >
                      <td className="py-2 pr-4 font-mono text-xs font-semibold text-[#1d1d1f]">
                        {item.numero}
                        {isDirty && <span className="ml-1 text-[#2563eb]">●</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${AREA_COLORS[item.area] ?? ""}`}>
                          {item.area}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={item.gabarito}
                          onChange={(e) => updateItem(item.id, "gabarito", e.target.value)}
                          className="rounded border border-[#e5e7eb] bg-white px-2 py-1 text-sm font-semibold text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none"
                          aria-label={`Gabarito do item ${item.numero}`}
                        >
                          {GABARITOSOPTIONS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={item.dificuldade}
                          onChange={(e) => updateItem(item.id, "dificuldade", Math.min(5, Math.max(1, Number(e.target.value))))}
                          className="w-16 rounded border border-[#e5e7eb] bg-white px-2 py-1 text-sm text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none"
                          aria-label={`Dificuldade do item ${item.numero}`}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={item.topico}
                          onChange={(e) => updateItem(item.id, "topico", e.target.value)}
                          placeholder="—"
                          className="w-full rounded border border-[#e5e7eb] bg-white px-2 py-1 text-sm text-[#1d1d1f] placeholder-[#d1d5db] focus:border-[#2563eb] focus:outline-none"
                          aria-label={`Tópico do item ${item.numero}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-[#e5e7eb] bg-[#f9fafb] px-6 py-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded px-2 py-1 text-xs text-[#71717a] hover:bg-[#e5e7eb] disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#71717a]">
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded px-2 py-1 text-xs text-[#71717a] hover:bg-[#e5e7eb] disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4 flex-shrink-0">
          <div>
            {saveError && (
              <p role="alert" className="text-xs text-[#dc2626]">{saveError}</p>
            )}
            {!saveError && dirtyCount === 0 && !loading && (
              <p className="text-xs text-[#71717a]">Edite os campos e clique em Salvar.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="text-sm font-medium text-[#71717a] hover:text-[#1d1d1f] disabled:opacity-50"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={dirtyCount === 0 || saving}
              className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:bg-[#e5e7eb] disabled:text-[#94a3b8]"
            >
              {saving ? "Salvando..." : dirtyCount > 0 ? `Salvar ${dirtyCount} alteração${dirtyCount !== 1 ? "ões" : ""}` : "Sem alterações"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
