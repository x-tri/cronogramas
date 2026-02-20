import { useState } from "react";
import { authenticate, login } from "../lib/auth";
import "./sign-css.css";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 400));

    const user = await authenticate(email, password);

    if (user) {
      login(user);
      onLoginSuccess();
    } else {
      setError("Email ou senha incorretos.");
    }

    setIsLoading(false);
  }

  return (
    <div className="login-container">
      <div className="logo-container">
        <img className="logo" alt="Mentoria ENEM Logo" src="/logo-xtri.png" />
        <h1 className="title">Mentoria ENEM</h1>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <h2 className="form-title">Login</h2>
        <div className="form-group">
          <label htmlFor="email">E-mail ou RA</label>
          <input
            id="email"
            type="text"
            className="input"
            placeholder="seu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="submit-btn" type="submit" disabled={isLoading}>
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
