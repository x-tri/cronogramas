/**
 * Passo 1 do wizard — metadata do simulado (title, escola, turmas).
 *
 * Regras:
 *   - super_admin: escolhe escola no dropdown (carregado pelo parent).
 *   - coordinator: escola ja vem pre-selecionada e o dropdown fica desabilitado.
 *   - turmas: multi-select a partir das turmas distintas de students.turma
 *     da escola. Vazio = "Todas as turmas" (aplica a todas da escola).
 */

import { useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";
import { validateMeta } from "../../../services/simulado/wizard/validation";
import type { SchoolOption, WizardStateMeta } from "./types";

export interface StepMetaProps {
  readonly meta: WizardStateMeta;
  readonly onChange: (meta: WizardStateMeta) => void;
  readonly schools: ReadonlyArray<SchoolOption>;
  readonly isSchoolScoped: boolean;
  readonly lockedSchoolId: string | null;
}

export function StepMeta({
  meta,
  onChange,
  schools,
  isSchoolScoped,
  lockedSchoolId,
}: StepMetaProps) {
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<ReadonlyArray<string>>(
    [],
  );
  // 3 estados da query de turmas: idle (sem escola), loading, done, error.
  type TurmasStatus = "idle" | "loading" | "done" | "error";
  const [turmasStatus, setTurmasStatus] = useState<TurmasStatus>("idle");
  const [turmasError, setTurmasError] = useState<string | null>(null);

  // Quando escola muda, recarrega turmas disponiveis. Flag de cancelamento
  // evita setState apos unmount. queueMicrotask usado para evitar lint
  // react-hooks/set-state-in-effect ao mesmo tempo em que provemos UX
  // intermediaria (loading vs done vs error).
  useEffect(() => {
    let cancelled = false;

    if (!meta.schoolId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setTurmasDisponiveis([]);
        setTurmasStatus("idle");
        setTurmasError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setTurmasStatus("loading");
    });

    supabase
      .from("students")
      .select("turma")
      .eq("school_id", meta.schoolId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setTurmasDisponiveis([]);
          setTurmasStatus("error");
          setTurmasError(error.message);
          return;
        }
        const unique = [
          ...new Set(
            (data ?? [])
              .map((r: { turma: string | null }) => (r.turma ?? "").trim())
              .filter((t: string) => t.length > 0),
          ),
        ].sort();
        setTurmasDisponiveis(unique);
        setTurmasStatus("done");
        setTurmasError(null);
      });

    return () => {
      cancelled = true;
    };
  }, [meta.schoolId]);

  const metaIssues = validateMeta(meta);
  const hasTitleIssue = metaIssues.some(
    (i) => i.kind === "title_empty" || i.kind === "title_too_long",
  );
  const hasSchoolIssue = metaIssues.some((i) => i.kind === "school_required");

  const toggleTurma = (turma: string): void => {
    const next = meta.turmas.includes(turma)
      ? meta.turmas.filter((t) => t !== turma)
      : [...meta.turmas, turma];
    onChange({ ...meta, turmas: next });
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label
          htmlFor="sim-title"
          className="block text-sm font-medium text-[#1d1d1f] mb-1"
        >
          Nome do simulado <span className="text-[#dc2626]">*</span>
        </label>
        <input
          id="sim-title"
          type="text"
          value={meta.title}
          onChange={(e) => onChange({ ...meta, title: e.target.value })}
          maxLength={120}
          placeholder="Ex: Simulado ENEM Maio/2026 — 3º Ano"
          aria-invalid={hasTitleIssue}
          aria-describedby={hasTitleIssue ? "sim-title-error" : undefined}
          className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[#71717a]">
          {meta.title.length}/120 caracteres
        </p>
        {hasTitleIssue && (
          <p id="sim-title-error" className="mt-1 text-xs text-[#dc2626]">
            {metaIssues.find((i) => i.kind === "title_empty")
              ? "Informe um nome para o simulado."
              : "Maximo de 120 caracteres."}
          </p>
        )}
      </div>

      {/* School */}
      <div>
        <label
          htmlFor="sim-school"
          className="block text-sm font-medium text-[#1d1d1f] mb-1"
        >
          Escola <span className="text-[#dc2626]">*</span>
        </label>
        <select
          id="sim-school"
          value={isSchoolScoped && lockedSchoolId ? lockedSchoolId : meta.schoolId}
          onChange={(e) =>
            onChange({ ...meta, schoolId: e.target.value, turmas: [] })
          }
          disabled={isSchoolScoped}
          aria-invalid={hasSchoolIssue}
          aria-describedby={hasSchoolIssue ? "sim-school-error" : undefined}
          className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] disabled:bg-[#f4f4f5] disabled:text-[#71717a]"
        >
          <option value="">Selecione uma escola...</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {isSchoolScoped && (
          <p className="mt-1 text-xs text-[#71717a]">
            Coordenador cria simulados apenas para a propria escola.
          </p>
        )}
        {hasSchoolIssue && (
          <p id="sim-school-error" className="mt-1 text-xs text-[#dc2626]">
            Selecione uma escola.
          </p>
        )}
      </div>

      {/* Turmas multi-select */}
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
          Turmas alvo
        </label>
        <p className="mb-2 text-xs text-[#71717a]">
          Deixe vazio para liberar o simulado para todas as turmas da escola.
        </p>

        {!meta.schoolId && (
          <p className="text-xs text-[#94a3b8] italic">
            Selecione uma escola para carregar as turmas.
          </p>
        )}

        {meta.schoolId && turmasStatus === "loading" && (
          <p className="text-xs text-[#71717a]">Carregando turmas...</p>
        )}

        {meta.schoolId && turmasStatus === "error" && (
          <p role="alert" className="text-xs text-[#dc2626]">
            Falha ao carregar turmas: {turmasError ?? "erro desconhecido"}
          </p>
        )}

        {meta.schoolId &&
          turmasStatus === "done" &&
          turmasDisponiveis.length === 0 && (
            <p className="text-xs text-[#94a3b8] italic">
              Nenhuma turma cadastrada nesta escola. O simulado sera liberado
              para todos os alunos.
            </p>
          )}

        {turmasDisponiveis.length > 0 && (
          <div
            role="group"
            aria-label="Selecao de turmas"
            className="flex flex-wrap gap-2"
          >
            {turmasDisponiveis.map((turma) => {
              const checked = meta.turmas.includes(turma);
              return (
                <label
                  key={turma}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    checked
                      ? "border-[#2563eb] bg-[#2563eb] text-white"
                      : "border-[#e5e7eb] bg-white text-[#1d1d1f] hover:bg-[#f4f4f5]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleTurma(turma)}
                    aria-label={`Turma ${turma}`}
                  />
                  {turma}
                </label>
              );
            })}
          </div>
        )}

        {meta.turmas.length > 0 && (
          <p className="mt-2 text-xs text-[#71717a]">
            {meta.turmas.length} turma{meta.turmas.length === 1 ? "" : "s"}{" "}
            selecionada{meta.turmas.length === 1 ? "" : "s"}:{" "}
            <strong className="text-[#1d1d1f]">{meta.turmas.join(", ")}</strong>
          </p>
        )}
      </div>

      {/* Link do caderno de questões */}
      <div>
        <label
          htmlFor="sim-caderno-url"
          className="block text-sm font-medium text-[#1d1d1f] mb-1"
        >
          Link do caderno de questões{" "}
          <span className="text-[10px] font-normal text-[#71717a]">(opcional)</span>
        </label>
        <input
          id="sim-caderno-url"
          type="url"
          value={meta.caderno_url}
          onChange={(e) => onChange({ ...meta, caderno_url: e.target.value })}
          placeholder="https://drive.google.com/file/d/..."
          className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:border-[#2563eb] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[#71717a]">
          Cole o link do Google Drive (ou qualquer URL pública). Alunos verão um botão "Baixar Caderno".
        </p>
      </div>
    </div>
  );
}
