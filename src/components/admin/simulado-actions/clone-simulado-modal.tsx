/**
 * CloneSimuladoModal — duplica um simulado existente para OUTRA escola.
 *
 * Fluxo:
 *   1. super_admin escolhe escola destino do dropdown
 *   2. (opcional) altera titulo e turmas alvo
 *   3. (opcional) marca pra copiar tambem o caderno_url
 *   4. Submit chama RPC clone_simulado_to_school
 *   5. Novo simulado nasce como 'draft' na escola destino
 *
 * Coordinator: nao usa esse modal (so super_admin tem multiplas escolas
 * disponiveis). Mesmo assim a RPC tem checagem de role.
 */

import { useState } from "react";

import { supabase } from "../../../lib/supabase";

interface School {
  readonly id: string;
  readonly name: string;
}

interface SourceSimulado {
  readonly id: string;
  readonly title: string;
  readonly school_id: string;
  readonly turmas: readonly string[];
  readonly caderno_url: string | null;
}

interface CloneSimuladoModalProps {
  readonly open: boolean;
  readonly source: SourceSimulado | null;
  readonly schools: ReadonlyArray<School>;
  readonly onClose: () => void;
  readonly onCloned: (newSimuladoId: string) => void;
}

interface CloneRpcArgs {
  readonly p_source_simulado_id: string;
  readonly p_target_school_id: string;
  readonly p_new_title: string | null;
  readonly p_new_turmas: ReadonlyArray<string> | null;
  readonly p_copy_caderno_url: boolean;
}

export function CloneSimuladoModal({
  open,
  source,
  schools,
  onClose,
  onCloned,
}: CloneSimuladoModalProps) {
  const [targetSchoolId, setTargetSchoolId] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [turmasText, setTurmasText] = useState<string>("");
  const [copyCadernoUrl, setCopyCadernoUrl] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open || !source) return null;

  const sourceSchool = schools.find((s) => s.id === source.school_id);
  // Escolas disponiveis = todas exceto a origem (clone DEVE ser pra outra escola)
  const availableTargets = schools.filter((s) => s.id !== source.school_id);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!targetSchoolId) {
      setErrorMsg("Selecione a escola destino");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const turmas: ReadonlyArray<string> = turmasText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const args: CloneRpcArgs = {
      p_source_simulado_id: source.id,
      p_target_school_id: targetSchoolId,
      p_new_title: newTitle.trim() || null,
      p_new_turmas: turmas.length > 0 ? turmas : null,
      p_copy_caderno_url: copyCadernoUrl,
    };

    const { data, error } = await supabase.rpc("clone_simulado_to_school", args);

    if (error) {
      setSubmitting(false);
      setErrorMsg(error.message);
      return;
    }

    setSubmitting(false);
    onCloned(data as string);
  };

  const reset = (): void => {
    setTargetSchoolId("");
    setNewTitle("");
    setTurmasText("");
    setCopyCadernoUrl(false);
    setErrorMsg(null);
  };

  const handleClose = (): void => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-modal-title"
        className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#f4f4f5] px-5 py-3">
          <h2 id="clone-modal-title" className="text-base font-bold text-[#1d1d1f]">
            📋 Duplicar simulado
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fechar"
            className="text-[#71717a] hover:text-[#1d1d1f] disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          <div className="rounded-lg bg-[#f8fafc] p-3 text-xs">
            <p className="text-[#71717a]">
              <span className="font-bold text-[#1d1d1f]">Origem:</span> {source.title}
            </p>
            <p className="text-[#71717a] mt-1">
              <span className="font-bold text-[#1d1d1f]">Escola origem:</span>{" "}
              {sourceSchool?.name ?? "—"}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-2 italic">
              Os 180 itens (gabarito + dificuldade + tópico + habilidade) serão copiados
              integralmente. Novo simulado começa como rascunho.
            </p>
          </div>

          {availableTargets.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Não há outras escolas disponíveis para clonar. Você só tem 1 escola
              cadastrada.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="clone-school" className="text-xs font-bold text-[#1d1d1f]">
                  Escola destino *
                </label>
                <select
                  id="clone-school"
                  value={targetSchoolId}
                  onChange={(e) => setTargetSchoolId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] disabled:opacity-60"
                >
                  <option value="">Selecione...</option>
                  {availableTargets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="clone-title" className="text-xs font-bold text-[#1d1d1f]">
                  Novo título
                </label>
                <input
                  id="clone-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`${source.title} (cópia)`}
                  disabled={submitting}
                  className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] disabled:opacity-60"
                />
                <p className="text-[10px] text-[#94a3b8]">
                  Deixe em branco para usar o padrão.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="clone-turmas" className="text-xs font-bold text-[#1d1d1f]">
                  Turmas alvo
                </label>
                <input
                  id="clone-turmas"
                  type="text"
                  value={turmasText}
                  onChange={(e) => setTurmasText(e.target.value)}
                  placeholder="Ex: A, B, 3M1 (vazio = todas)"
                  disabled={submitting}
                  className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] disabled:opacity-60"
                />
                <p className="text-[10px] text-[#94a3b8]">
                  Separe por vírgula. Vazio = simulado disponível para todas as turmas
                  da escola.
                </p>
              </div>

              {source.caderno_url && (
                <label className="flex items-start gap-2 text-xs text-[#1d1d1f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyCadernoUrl}
                    onChange={(e) => setCopyCadernoUrl(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 h-4 w-4 accent-[#2563eb]"
                  />
                  <span>
                    Copiar também o link do caderno PDF
                    <span className="block text-[10px] text-[#94a3b8] mt-0.5">
                      Por padrão cada escola usa seu próprio caderno.
                    </span>
                  </span>
                </label>
              )}

              {errorMsg && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                  {errorMsg}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#f4f4f5]">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#71717a] hover:bg-[#f4f4f5] disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || availableTargets.length === 0 || !targetSchoolId}
              className="rounded-md bg-[#2563eb] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {submitting ? "Duplicando..." : "Duplicar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
