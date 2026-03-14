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
    <main className="flex min-h-svh items-center justify-center bg-[#ececef] px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#37352f]">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <h1 className="text-[40px] font-semibold text-[#1d1d1f] tracking-[-0.02em]">
            XTRI Cronogramas
          </h1>
          <p className="mt-1 text-[31px] text-[#6b6b67]">Área restrita — Professores</p>
        </div>

        <form
          className="rounded-3xl border border-[#d7d7dc] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-[#37352f]">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                className="w-full rounded-xl border border-[#d3d3d8] px-3 py-2 text-base text-[#1d1d1f] outline-none transition-colors focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder="Digite seu usuário"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#37352f]">
                Senha
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-xl border border-[#d3d3d8] px-3 py-2 text-base text-[#1d1d1f] outline-none transition-colors focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#a9a9b0] text-base font-medium text-white transition-colors hover:bg-[#909099] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-[#9ca3af]">XTRI Cronogramas · Versão 2.0</p>
      </div>
    </main>
  );
}
