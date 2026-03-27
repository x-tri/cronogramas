import { useState } from "react";
import { supabase } from "../lib/supabase";

interface ChangePasswordFormProps {
  userName: string;
  onSuccess: () => void;
}

export function ChangePasswordForm({ userName, onSuccess }: ChangePasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsLoading(true);

    try {
      // Update password via Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Mark must_change_password = false
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("project_users")
          .update({ must_change_password: false })
          .eq("auth_uid", user.id);
      }

      onSuccess();
    } catch {
      setError("Erro ao trocar senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f5f7] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <img
            src="/logo-xtri.png"
            alt="XTRI"
            className="mx-auto mb-4 h-16 w-16 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
            Trocar Senha
          </h1>
          <p className="mt-1 text-sm text-[#86868b]">
            Ola, {userName}! Defina uma nova senha para continuar.
          </p>
        </div>

        {/* Form */}
        <form
          className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-lg border border-[#fef3c7] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
              Por seguranca, voce precisa criar uma senha pessoal no primeiro acesso.
            </div>

            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-sm font-medium text-[#1d1d1f]">
                Nova senha
              </label>
              <input
                id="newPassword"
                type="password"
                className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="Minimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-[#1d1d1f]">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] active:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Salvando...
                </span>
              ) : (
                "Definir nova senha"
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-[#94a3b8]">
          XTRI Cronogramas · v2.0
        </p>
      </div>
    </main>
  );
}
