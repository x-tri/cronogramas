import { useState } from "react";
import { supabase } from "../lib/supabase";
import { logout } from "../lib/auth";

interface LinkInviteCodeProps {
  userName: string;
  userEmail: string;
  onSuccess: () => void;
  onLogout: () => void;
}

export function LinkInviteCode({ userName, userEmail, onSuccess, onLogout }: LinkInviteCodeProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function formatCode(raw: string): string {
    // Remove tudo que não é letra/número, uppercase
    const clean = raw.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
    // Se já tem o prefixo XTRI-, mantém
    if (clean.startsWith("XTRI-")) return clean.slice(0, 9);
    // Se o usuário digitou só os 4 chars, adiciona prefixo
    if (clean.length <= 4 && !clean.includes("-")) return clean;
    return clean.slice(0, 9);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Montar código completo
    const fullCode = code.includes("-") ? code.toUpperCase() : `XTRI-${code.toUpperCase()}`;

    if (fullCode.length < 9) {
      setError("Código incompleto. O formato é XTRI-XXXX.");
      setIsLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("link_google_to_coordinator", {
      p_invite_code: fullCode,
    });

    if (rpcError) {
      setError("Erro ao vincular. Tente novamente.");
      setIsLoading(false);
      return;
    }

    const result = data as { success: boolean; message: string; school_name?: string; role?: string };

    if (!result.success) {
      setError(result.message);
      setIsLoading(false);
      return;
    }

    setSuccess(result.school_name ?? "");
    // Dar tempo pro usuário ver a mensagem de sucesso
    setTimeout(() => {
      onSuccess();
    }, 1500);
  }

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f5f7] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/logo-xtri.png"
            alt="XTRI"
            className="mx-auto mb-4 h-16 w-16 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
            Vincular acesso
          </h1>
          <p className="mt-1 text-sm text-[#86868b]">
            Digite o código que você recebeu do admin
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm space-y-5">
          {/* Perfil Google */}
          <div className="flex items-center gap-3 rounded-xl bg-[#f8fafc] border border-[#e5e7eb] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb] text-white text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{userName}</p>
              <p className="text-xs text-[#64748b] truncate">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-[#94a3b8] hover:text-[#dc2626] transition-colors"
            >
              Trocar
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {error}
            </div>
          )}

          {success !== null ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-4 text-center">
              <p className="text-sm font-semibold text-[#166534]">
                Conta vinculada com sucesso!
              </p>
              {success && (
                <p className="text-xs text-[#15803d] mt-1">Escola: {success}</p>
              )}
              <p className="text-xs text-[#86efac] mt-2">Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="invite-code" className="text-sm font-medium text-[#1d1d1f]">
                  Código de acesso
                </label>
                <input
                  id="invite-code"
                  type="text"
                  className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-3 text-center text-lg font-mono font-bold tracking-[0.2em] text-[#1d1d1f] uppercase outline-none transition-all placeholder:text-[#9ca3af] placeholder:tracking-normal placeholder:font-normal placeholder:text-sm focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                  placeholder="XTRI-XXXX"
                  value={code}
                  onChange={(e) => setCode(formatCode(e.target.value))}
                  maxLength={9}
                  autoFocus
                />
                <p className="text-[11px] text-[#94a3b8] text-center">
                  Peça ao administrador da sua escola
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || code.replace(/[^A-Za-z0-9]/g, "").length < 4}
                className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] active:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Vinculando...
                  </span>
                ) : (
                  "Vincular minha conta"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#94a3b8]">
          XTRI Cronogramas · v2.0 · Área restrita
        </p>
      </div>
    </main>
  );
}
