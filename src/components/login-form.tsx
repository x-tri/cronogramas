import { useState } from "react";
import { authenticate, login } from "../lib/auth";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 400));

    const user = await authenticate(username, password);

    if (user) {
      login(user);
      onLoginSuccess();
    } else {
      setError("Email ou senha incorretos.");
    }

    setIsLoading(false);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f5f7] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + Title */}
        <div className="text-center">
          <img
            src="/logo-xtri.png"
            alt="XTRI"
            className="mx-auto mb-4 h-16 w-16 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
            XTRI Cronogramas
          </h1>
          <p className="mt-1 text-sm text-[#86868b]">
            Planejamento de estudos ENEM
          </p>
        </div>

        {/* Login Card */}
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
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-[#1d1d1f]">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="Digite seu usuário"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#1d1d1f]">
                Senha
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-[#94a3b8]">
          XTRI Cronogramas · v2.0 · Área restrita
        </p>
      </div>
    </main>
  );
}
