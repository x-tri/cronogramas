/**
 * Passo 3 do wizard — preview + submit.
 *
 * Mostra resumo final (meta + estatisticas por area) e permite enviar ao
 * RPC `create_simulado_with_items`. O submit em si e feito pelo orquestrador
 * (index.tsx) — este componente so renderiza.
 */

import { useMemo } from "react";

import { summarizeItems } from "../../../services/simulado/wizard/validation";
import type { SimuladoItemDraft } from "../../../services/simulado/wizard/csv-parser";
import type { SchoolOption, WizardStateMeta } from "./types";

export interface StepPreviewProps {
  readonly meta: WizardStateMeta;
  readonly items: ReadonlyArray<SimuladoItemDraft>;
  readonly schools: ReadonlyArray<SchoolOption>;
  readonly saving: boolean;
  readonly errorMessage: string | null;
}

const AREAS: ReadonlyArray<{
  readonly key: "LC" | "CH" | "CN" | "MT";
  readonly label: string;
  readonly range: string;
}> = [
  { key: "LC", label: "Linguagens", range: "1-45" },
  { key: "CH", label: "Humanas", range: "46-90" },
  { key: "CN", label: "Natureza", range: "91-135" },
  { key: "MT", label: "Matematica", range: "136-180" },
];

export function StepPreview({
  meta,
  items,
  schools,
  saving,
  errorMessage,
}: StepPreviewProps) {
  const summary = useMemo(() => summarizeItems(items), [items]);
  const schoolName = useMemo(
    () => schools.find((s) => s.id === meta.schoolId)?.name ?? "—",
    [schools, meta.schoolId],
  );

  const turmasLabel =
    meta.turmas.length === 0 ? "Todas as turmas" : meta.turmas.join(", ");

  const dificuldadeMedia = items.length
    ? (
        items.reduce((sum, i) => sum + i.dificuldade, 0) / items.length
      ).toFixed(2)
    : "—";

  return (
    <div className="space-y-5">
      {/* Resumo meta */}
      <section
        aria-label="Resumo do simulado"
        className="rounded-lg border border-[#e5e7eb] bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">
          Revise antes de salvar
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-3">
            <dt className="font-medium text-[#71717a]">Nome:</dt>
            <dd className="text-[#1d1d1f]">{meta.title}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="font-medium text-[#71717a]">Escola:</dt>
            <dd className="text-[#1d1d1f]">{schoolName}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="font-medium text-[#71717a]">Turmas alvo:</dt>
            <dd className="text-[#1d1d1f]">{turmasLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="font-medium text-[#71717a]">Status inicial:</dt>
            <dd className="text-[#1d1d1f]">
              Rascunho (publique depois na listagem)
            </dd>
          </div>
        </dl>
      </section>

      {/* Estatisticas por area */}
      <section
        aria-label="Estatisticas por area"
        className="rounded-lg border border-[#e5e7eb] bg-white p-4"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-[#1d1d1f]">
              {summary.total} / 180 itens cadastrados
            </p>
            <p className="mt-1 text-xs text-[#71717a]">
              Dificuldade media (Angoff): {dificuldadeMedia}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {AREAS.map((area) => (
              <div
                key={area.key}
                className="rounded-md bg-[#f4f4f5] px-3 py-2 text-center"
              >
                <div className="text-[10px] font-medium text-[#71717a]">
                  {area.label}
                </div>
                <div className="text-[9px] text-[#94a3b8]">({area.range})</div>
                <div
                  className={`mt-0.5 text-sm font-bold ${
                    summary.byArea[area.key] === 45
                      ? "text-[#166534]"
                      : "text-[#9a3412]"
                  }`}
                >
                  {summary.byArea[area.key]}/45
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Amostra dos primeiros itens de cada area */}
      <section
        aria-label="Amostra de itens"
        className="rounded-lg border border-[#e5e7eb] bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">
          Amostra (3 primeiros itens de cada area)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[#71717a]">
              <tr>
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">Area</th>
                <th className="px-2 py-1 text-left">Conteudo</th>
                <th className="px-2 py-1 text-left">Gabarito</th>
                <th className="px-2 py-1 text-left">Dif.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f4f5]">
              {AREAS.flatMap((area) =>
                items
                  .filter((it) => {
                    if (area.key === "LC") return it.numero >= 1 && it.numero <= 45;
                    if (area.key === "CH") return it.numero >= 46 && it.numero <= 90;
                    if (area.key === "CN") return it.numero >= 91 && it.numero <= 135;
                    return it.numero >= 136 && it.numero <= 180;
                  })
                  .slice(0, 3)
                  .map((item) => (
                    <tr key={item.numero}>
                      <td className="px-2 py-1 font-mono">{item.numero}</td>
                      <td className="px-2 py-1">{area.key}</td>
                      <td className="px-2 py-1 text-[#1d1d1f]">
                        {item.topico ?? (
                          <span className="italic text-[#94a3b8]">
                            (sem conteudo)
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 font-semibold">
                        {item.gabarito}
                      </td>
                      <td className="px-2 py-1">{item.dificuldade}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Erro de submit (se houver) */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]"
        >
          {errorMessage}
        </div>
      )}

      {saving && (
        <p
          role="status"
          aria-label="Salvando simulado"
          className="text-sm text-[#71717a]"
        >
          Salvando simulado como rascunho...
        </p>
      )}
    </div>
  );
}
