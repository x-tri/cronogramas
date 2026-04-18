/**
 * Passo 2 do wizard — import + refinamento dos 180 itens.
 *
 * UX:
 *   - Dropzone/textarea para CSV (paste OR file upload)
 *   - Download de template CSV
 *   - Apos parse, mostra dashboard de completude (X/180, por area)
 *   - Lista erros de parse com linha + mensagem
 *   - Tabela expansivel para revisao + edicao inline (gabarito + dificuldade)
 *     - Limita visualizacao a 20 itens + paginacao para nao quebrar perf
 *
 * Nao se comunica com o DB; apenas atualiza o estado no parent.
 */

import { useMemo, useRef, useState } from "react";

import {
  parseSimuladoCsv,
  type ParseError,
  type SimuladoItemDraft,
} from "../../../services/simulado/wizard/csv-parser";
import {
  formatGapsMessage,
  summarizeItems,
} from "../../../services/simulado/wizard/validation";

export interface StepItemsProps {
  readonly items: ReadonlyArray<SimuladoItemDraft>;
  readonly onChange: (items: ReadonlyArray<SimuladoItemDraft>) => void;
}

const CSV_TEMPLATE =
  "numero,conteudo,gabarito,dificuldade\n" +
  "1,Funcoes exponenciais,A,3\n" +
  "2,Geometria analitica,B,4\n" +
  "...,...,...,...\n" +
  "180,Ultimo item,E,3\n";

const PAGE_SIZE = 20;

function downloadTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "simulado-template.csv";
  document.body.appendChild(a);
  a.click();
  // Alguns browsers iniciam o download assincronamente; revogar fora do
  // tick atual garante que o download comece antes da URL ser invalidada.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

function areaOf(numero: number): "LC" | "CH" | "CN" | "MT" | null {
  if (numero >= 1 && numero <= 45) return "LC";
  if (numero >= 46 && numero <= 90) return "CH";
  if (numero >= 91 && numero <= 135) return "CN";
  if (numero >= 136 && numero <= 180) return "MT";
  return null;
}

export function StepItems({ items, onChange }: StepItemsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState<string>("");
  const [parseErrors, setParseErrors] = useState<ReadonlyArray<ParseError>>([]);
  const [page, setPage] = useState<number>(1);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const summary = useMemo(() => summarizeItems(items), [items]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageSlice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleParse = (text: string): void => {
    const result = parseSimuladoCsv(text);
    if (!result.ok) {
      // Em falha: limpa itens existentes para evitar estado inconsistente
      // (itens antigos OK + CSV novo errado fica ambiguo para o usuario).
      onChange([]);
      setParseErrors(result.errors);
      setPage(1);
      return;
    }
    setParseErrors([]);
    onChange(result.items);
    setPage(1);
  };

  const handleFile = (file: File): void => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (): void => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setRawText(text);
      handleParse(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleItemChange = (
    numero: number,
    patch: Partial<SimuladoItemDraft>,
  ): void => {
    const next = items.map((it) =>
      it.numero === numero ? { ...it, ...patch } : it,
    );
    onChange(next);
  };

  const clearAll = (): void => {
    setRawText("");
    setParseErrors([]);
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange([]);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Dropzone + textarea */}
      <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">
            Importar gabarito + conteudo
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs font-medium text-[#2563eb] hover:underline"
            >
              Baixar template CSV
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-[#dc2626] hover:underline"
              >
                Limpar tudo
              </button>
            )}
          </div>
        </div>

        <p className="mt-1 text-xs text-[#71717a]">
          Formato:{" "}
          <code className="rounded bg-[#f4f4f5] px-1 py-0.5 text-[11px]">
            numero,conteudo,gabarito,dificuldade
          </code>
        </p>

        {/* Input escondido + botao custom */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          aria-label="Upload de arquivo CSV"
          className="sr-only"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-[#2563eb] bg-[#eff6ff] px-4 py-2 text-xs font-semibold text-[#2563eb] hover:bg-[#dbeafe] transition-colors"
            aria-label="Selecionar arquivo CSV"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Enviar arquivo CSV
          </button>
          {uploadedFileName && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0fdf4] px-2.5 py-1 text-xs font-medium text-[#166534]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {uploadedFileName}
            </span>
          )}
          <span className="text-xs text-[#94a3b8]">
            ou cole o conteudo abaixo ↓
          </span>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Ou cole o CSV aqui..."
          rows={6}
          aria-label="Colar CSV"
          className="mt-3 w-full rounded-md border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 font-mono text-xs text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => handleParse(rawText)}
            disabled={rawText.trim().length === 0}
            className="rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white disabled:bg-[#e5e7eb] disabled:text-[#94a3b8]"
          >
            Processar CSV
          </button>
        </div>
      </section>

      {/* Erros de parse */}
      {parseErrors.length > 0 && (
        <section
          role="alert"
          className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4"
        >
          <h3 className="text-sm font-semibold text-[#991b1b]">
            {parseErrors.length} erro{parseErrors.length === 1 ? "" : "s"} no CSV
          </h3>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[#991b1b]">
            {parseErrors.slice(0, 50).map((err, idx) => (
              <li key={`${err.line}-${idx}`}>
                <strong>Linha {err.line}:</strong> {err.message}
              </li>
            ))}
          </ul>
          {parseErrors.length > 50 && (
            <p className="mt-1 text-xs text-[#991b1b]">
              ...e mais {parseErrors.length - 50} erros.
            </p>
          )}
        </section>
      )}

      {/* Dashboard de completude */}
      {items.length > 0 && (
        <section
          aria-label="Resumo de completude"
          className={`rounded-lg border p-4 ${
            summary.isComplete
              ? "border-[#bbf7d0] bg-[#f0fdf4]"
              : "border-[#fed7aa] bg-[#fff7ed]"
          }`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">
                {summary.total} / 180 itens{" "}
                {summary.isComplete && (
                  <span className="text-[#166534]">— completo</span>
                )}
              </p>
              {!summary.isComplete && (
                <p className="mt-1 text-xs text-[#9a3412]">
                  {formatGapsMessage(summary.gaps)}
                </p>
              )}
              {summary.duplicateNumeros.length > 0 && (
                <p className="mt-1 text-xs text-[#dc2626]">
                  Duplicatas: {summary.duplicateNumeros.join(", ")}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {(["LC", "CH", "CN", "MT"] as const).map((area) => (
                <div
                  key={area}
                  className="rounded-md bg-white px-2 py-1 text-center"
                >
                  <div className="text-[10px] font-medium text-[#71717a]">
                    {area}
                  </div>
                  <div
                    className={`text-sm font-bold ${
                      summary.byArea[area] === 45
                        ? "text-[#166534]"
                        : "text-[#9a3412]"
                    }`}
                  >
                    {summary.byArea[area]}/45
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tabela editavel */}
      {items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Revisar itens ({(page - 1) * PAGE_SIZE + 1}-
              {Math.min(page * PAGE_SIZE, items.length)} de {items.length})
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-[#e5e7eb] px-2 py-1 disabled:opacity-40"
                aria-label="Pagina anterior"
              >
                ←
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-[#e5e7eb] px-2 py-1 disabled:opacity-40"
                aria-label="Proxima pagina"
              >
                →
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white">
            <table className="w-full text-xs">
              <thead className="bg-[#f4f4f5] text-[#71717a]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Area</th>
                  <th className="px-3 py-2 text-left font-medium">Conteudo</th>
                  <th className="px-3 py-2 text-left font-medium">Gabarito</th>
                  <th className="px-3 py-2 text-left font-medium">Dif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f5]">
                {pageSlice.map((item) => (
                  <ItemRow
                    key={item.numero}
                    item={item}
                    onChange={(patch) => handleItemChange(item.numero, patch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemRow (edicao inline)
// ---------------------------------------------------------------------------

interface ItemRowProps {
  readonly item: SimuladoItemDraft;
  readonly onChange: (patch: Partial<SimuladoItemDraft>) => void;
}

function ItemRow({ item, onChange }: ItemRowProps) {
  const area = areaOf(item.numero);
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-[#1d1d1f]">{item.numero}</td>
      <td className="px-3 py-2">
        <span className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-semibold text-[#71717a]">
          {area ?? "?"}
        </span>
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={item.topico ?? ""}
          onChange={(e) =>
            onChange({ topico: e.target.value.trim() || null })
          }
          aria-label={`Conteudo do item ${item.numero}`}
          className="w-full rounded border border-[#e5e7eb] bg-white px-2 py-1 text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={item.gabarito}
          onChange={(e) => {
            // Narrow runtime para evitar valores fora do schema do DB.
            const v = e.target.value;
            if (v === "A" || v === "B" || v === "C" || v === "D" || v === "E") {
              onChange({ gabarito: v });
            }
          }}
          aria-label={`Gabarito do item ${item.numero}`}
          className="rounded border border-[#e5e7eb] bg-white px-1.5 py-1 font-semibold"
        >
          {(["A", "B", "C", "D", "E"] as const).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <DifficultyPills
          value={item.dificuldade}
          onChange={(v) => onChange({ dificuldade: v })}
          numero={item.numero}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// DifficultyPills — 5 botoes em cores graduais (Angoff)
// ---------------------------------------------------------------------------

const PILL_COLORS: Readonly<Record<number, { bg: string; fg: string }>> = {
  1: { bg: "bg-[#bbf7d0]", fg: "text-[#166534]" },
  2: { bg: "bg-[#d9f99d]", fg: "text-[#365314]" },
  3: { bg: "bg-[#fef08a]", fg: "text-[#713f12]" },
  4: { bg: "bg-[#fdba74]", fg: "text-[#7c2d12]" },
  5: { bg: "bg-[#fca5a5]", fg: "text-[#7f1d1d]" },
};

const PILL_TOOLTIPS: Readonly<Record<number, string>> = {
  1: "Muito facil (~>85% acerto)",
  2: "Facil (70-85%)",
  3: "Media (50-70%)",
  4: "Dificil (30-50%)",
  5: "Muito dificil (<30%)",
};

interface DifficultyPillsProps {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly numero: number;
}

function DifficultyPills({ value, onChange, numero }: DifficultyPillsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={`Dificuldade do item ${numero}`}
      className="flex items-center gap-0.5"
    >
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const active = n === value;
        const style = active ? PILL_COLORS[n]! : { bg: "bg-white", fg: "text-[#71717a]" };
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${n} — ${PILL_TOOLTIPS[n]}`}
            title={PILL_TOOLTIPS[n]}
            onClick={() => onChange(n)}
            className={`h-6 w-6 rounded border border-[#e5e7eb] text-[11px] font-bold ${style.bg} ${style.fg}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
