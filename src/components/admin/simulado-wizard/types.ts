/**
 * Tipos compartilhados entre os 3 steps do wizard de criacao de simulado.
 */

import type { SimuladoItemDraft } from "../../../services/simulado/wizard/csv-parser";

export interface SchoolOption {
  readonly id: string;
  readonly name: string;
}

export interface WizardStateMeta {
  readonly title: string;
  readonly schoolId: string;
  readonly turmas: readonly string[];
}

export interface WizardState {
  readonly meta: WizardStateMeta;
  readonly items: readonly SimuladoItemDraft[];
}

export const INITIAL_WIZARD_STATE: WizardState = {
  meta: { title: "", schoolId: "", turmas: [] },
  items: [],
};

export const WIZARD_STEPS = ["meta", "items", "preview"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
