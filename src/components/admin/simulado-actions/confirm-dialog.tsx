/**
 * ConfirmDialog — modal generico de confirmacao para acoes destrutivas
 * (publicar, fechar, excluir simulado).
 *
 * Renderizado via portal-less inline (composicao simples) para ficar
 * consistente com o wizard (Fase 3.2 B).
 */

import { useEffect, useRef } from "react";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: "default" | "danger";
  readonly loading?: boolean;
  readonly errorMessage?: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Foco automatico no botao de confirmar ao abrir (mantem teclado fluido).
  useEffect(() => {
    if (open) confirmBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "rounded-md bg-[#dc2626] px-4 py-2 text-sm font-medium text-white hover:bg-[#b91c1c] disabled:opacity-50"
      : "rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <header className="px-6 py-4 border-b border-[#e5e7eb]">
          <h3 id="confirm-dialog-title" className="text-base font-semibold text-[#1d1d1f]">
            {title}
          </h3>
        </header>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-[#71717a] whitespace-pre-line">{message}</p>
          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#991b1b]"
            >
              {errorMessage}
            </p>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[#e5e7eb]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-sm font-medium text-[#71717a] hover:text-[#1d1d1f] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmClass}
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
