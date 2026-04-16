import { useEffect, useState } from "react";
import { authenticate, login, signInWithGoogle } from "../lib/auth";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [emailLogin, setEmailLogin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  useEffect(() => {
    const resetLoadingState = () => {
      setIsGoogleLoading(false);
      setIsPasswordLoading(false);
    };

    resetLoadingState();
    window.addEventListener("pageshow", resetLoadingState);
    return () => window.removeEventListener("pageshow", resetLoadingState);
  }, []);

  async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timeoutId: number | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setIsPasswordLoading(false);
    setIsGoogleLoading(true);

    try {
      const { error: googleError } = await withTimeout(
        signInWithGoogle(),
        15000,
        "A conexão com Google demorou demais. Tente novamente.",
      );

      if (googleError) {
        setError("Erro ao conectar com Google. Tente novamente.");
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com Google.");
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsGoogleLoading(false);
    setIsPasswordLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 400));

      const identifier = emailLogin.trim() || username.trim();
      const user = await withTimeout(
        authenticate(identifier, password),
        15000,
        "O login demorou demais. Verifique a conexão e tente novamente.",
      );

      if (user) {
        login(user);
        onLoginSuccess();
      } else {
        setError("Email ou senha incorretos.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao fazer login. Tente novamente.",
      );
    } finally {
      setIsPasswordLoading(false);
    }
  }

  const isAnyLoading = isGoogleLoading || isPasswordLoading;

  const handleIdentifierChange = (value: string) => {
    setUsername(value);
    setEmailLogin(value);
    if (error) setError("");
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (error) setError("");
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
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {error}
            </div>
          )}

          {/* Google — botão primário */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isAnyLoading}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#e5e7eb] bg-white text-sm font-semibold text-[#1d1d1f] shadow-sm transition-all hover:bg-[#f8fafc] hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {isGoogleLoading ? "Conectando..." : "Entrar com Google"}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e5e7eb]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <button
                type="button"
                onClick={() => setShowEmailLogin(!showEmailLogin)}
                className="bg-white px-3 text-[#94a3b8] hover:text-[#64748b] transition-colors"
              >
                {showEmailLogin ? "Ocultar login com senha" : "Entrar com email e senha"}
              </button>
            </div>
          </div>

          {/* Email/Password — colapsável */}
          {showEmailLogin && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-medium text-[#1d1d1f]">
                  Usuário
                </label>
                <input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="username"
                  className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                  placeholder="Digite seu email"
                  required
                  value={emailLogin}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-[#1d1d1f]">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-[#9ca3af] focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                />
              </div>

              <button
                className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] active:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isAnyLoading}
              >
                {isPasswordLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
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
