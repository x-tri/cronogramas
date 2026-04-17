/**
 * Orquestrador do wizard de criacao de simulado (Fase 3.2).
 *
 * Fluxo:
 *   1. Parent (admin-simulados) abre o wizard passando `open`, `onClose`,
 *      `onCreated`, `isSchoolScoped`, `lockedSchoolId` e `schools`.
 *   2. Navega linearmente entre 3 steps (meta -> items -> preview).
 *   3. No submit chama RPC `create_simulado_with_items` via supabase client
 *      com service_role RLS bypass (auth do usuario logado gera auth.uid()
 *      no servidor).
 *   4. Em sucesso, chama `onCreated(simulado_id)` para o parent invalidar
 *      a lista.
 *
 * RLS: a RPC internamente valida role (super_admin|coordinator) + escopo
 * de escola. Client nao precisa pre-validar.
 */

import { useMemo, useState } from "react";

import { supabase } from "../../../lib/supabase";
import {
  canSubmit,
  summarizeItems,
  validateMeta,
} from "../../../services/simulado/wizard/validation";
import { StepItems } from "./step-items";
import { StepMeta } from "./step-meta";
import { StepPreview } from "./step-preview";
import {
  INITIAL_WIZARD_STATE,
  WIZARD_STEPS,
  type SchoolOption,
  type WizardState,
  type WizardStep,
} from "./types";

export interface SimuladoWizardProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Chamado apos criar simulado com sucesso (parent deve invalidar a lista). */
  readonly onCreated: () => void;
  readonly schools: ReadonlyArray<SchoolOption>;
  readonly isSchoolScoped: boolean;
  readonly lockedSchoolId: string | null;
}

const STEP_LABELS: Readonly<Record<WizardStep, string>> = {
  meta: "1. Dados",
  items: "2. Itens",
  preview: "3. Revisar",
};

export function SimuladoWizard({
  open,
  onClose,
  onCreated,
  schools,
  isSchoolScoped,
  lockedSchoolId,
}: SimuladoWizardProps) {
  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_WIZARD_STATE,
    meta: {
      ...INITIAL_WIZARD_STATE.meta,
      schoolId: isSchoolScoped && lockedSchoolId ? lockedSchoolId : "",
    },
  }));
  const [step, setStep] = useState<WizardStep>("meta");
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summary = useMemo(() => summarizeItems(state.items), [state.items]);
  const metaOk = validateMeta(state.meta).length === 0;
  const canGoToItems = metaOk;
  const canGoToPreview = metaOk && summary.isComplete;
  const canFinalSubmit = canSubmit(state.meta, state.items);

  if (!open) return null;

  const reset = (): void => {
    setState({
      ...INITIAL_WIZARD_STATE,
      meta: {
        ...INITIAL_WIZARD_STATE.meta,
        schoolId: isSchoolScoped && lockedSchoolId ? lockedSchoolId : "",
      },
    });
    setStep("meta");
    setSaving(false);
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleNext = (): void => {
    if (step === "meta" && canGoToItems) setStep("items");
    else if (step === "items" && canGoToPreview) setStep("preview");
  };

  const handleBack = (): void => {
    if (step === "items") setStep("meta");
    else if (step === "preview") setStep("items");
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canFinalSubmit) return;
    setSaving(true);
    setErrorMessage(null);

    const payload = {
      p_title: state.meta.title.trim(),
      p_school_id: state.meta.schoolId,
      p_turmas: state.meta.turmas,
      p_items: state.items.map((it) => ({
        numero: it.numero,
        gabarito: it.gabarito,
        dificuldade: it.dificuldade,
        topico: it.topico,
      })),
    };

    const { data, error } = await supabase.rpc(
      "create_simulado_with_items",
      payload,
    );

    if (error) {
      setSaving(false);
      setErrorMessage(error.message);
      return;
    }

    // Valida contrato do RPC: deve retornar uuid string nao-vazia.
    // Se um refactor futuro mudar o return type, queremos falhar visivelmente
    // em vez de passar silenciosamente para onCreated().
    if (typeof data !== "string" || data.trim().length === 0) {
      setSaving(false);
      setErrorMessage(
        "Erro interno: resposta invalida do servidor (RPC nao retornou ID).",
      );
      return;
    }

    setSaving(false);
    onCreated();
    reset();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Criar simulado ENEM"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            Criar simulado ENEM
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="rounded p-1 text-[#71717a] hover:bg-[#f4f4f5]"
          >
            ✕
          </button>
        </header>

        {/* Stepper */}
        <nav
          aria-label="Progresso do wizard"
          className="flex border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-3 text-xs"
        >
          {WIZARD_STEPS.map((s, idx) => {
            const current = step === s;
            const completed = WIZARD_STEPS.indexOf(step) > idx;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    current
                      ? "bg-[#2563eb] text-white"
                      : completed
                        ? "bg-[#166534] text-white"
                        : "bg-[#e5e7eb] text-[#71717a]"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  {completed ? "✓" : idx + 1}
                </span>
                <span
                  className={
                    current
                      ? "font-semibold text-[#1d1d1f]"
                      : "text-[#71717a]"
                  }
                >
                  {STEP_LABELS[s]}
                </span>
                {idx < WIZARD_STEPS.length - 1 && (
                  <span className="flex-1 border-t border-dashed border-[#e5e7eb]" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {step === "meta" && (
            <StepMeta
              meta={state.meta}
              onChange={(meta) => setState((s) => ({ ...s, meta }))}
              schools={schools}
              isSchoolScoped={isSchoolScoped}
              lockedSchoolId={lockedSchoolId}
            />
          )}
          {step === "items" && (
            <StepItems
              items={state.items}
              onChange={(items) => setState((s) => ({ ...s, items }))}
            />
          )}
          {step === "preview" && (
            <StepPreview
              meta={state.meta}
              items={state.items}
              schools={schools}
              saving={saving}
              errorMessage={errorMessage}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-medium text-[#71717a] hover:text-[#1d1d1f]"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {step !== "meta" && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="rounded-md border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] disabled:opacity-50"
              >
                Voltar
              </button>
            )}
            {step !== "preview" && (
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  (step === "meta" && !canGoToItems) ||
                  (step === "items" && !canGoToPreview)
                }
                aria-label="Avancar para proxima etapa"
                className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:bg-[#e5e7eb] disabled:text-[#94a3b8]"
              >
                {step === "meta" ? "Proximo: Itens" : "Proximo: Revisar"}
              </button>
            )}
            {step === "preview" && (
              <button
                type="button"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={!canFinalSubmit || saving}
                aria-label="Salvar simulado como rascunho"
                className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:bg-[#e5e7eb] disabled:text-[#94a3b8]"
              >
                {saving ? "Salvando..." : "Salvar rascunho"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
