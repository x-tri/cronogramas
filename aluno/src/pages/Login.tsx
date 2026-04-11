import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import logoXtri from "@/assets/logo-xtri.png";

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const [matricula, setMatricula] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await signIn(matricula, password);
    if (error) setError("Matrícula ou senha incorretos.");
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-accent/5 px-4">
      {/* Logo + mascot area */}
      <div className="animate-bounce-in mb-6 flex flex-col items-center">
        <div className="animate-float mb-4">
          <img src={logoXtri} alt="XTRI" className="h-20 w-20 drop-shadow-lg" />
        </div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">
          Portal do Aluno
        </h1>
        <p className="text-sm font-semibold text-muted-foreground mt-1 flex items-center gap-1">
          <Sparkles className="h-4 w-4 text-accent" />
          Estude, evolua e conquiste!
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm animate-bounce-in" style={{ animationDelay: "0.15s" }}>
        <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matricula" className="text-sm font-bold">
                🎓 Matrícula
              </Label>
              <Input
                id="matricula"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 214140291"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                required
                className="h-12 rounded-xl border-2 text-base font-semibold transition-all focus:border-primary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold">
                🔒 Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-2 text-base font-semibold transition-all focus:border-primary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-center">
                <p className="text-sm font-bold text-destructive">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-black uppercase tracking-wide shadow-[0_4px_0_0_hsl(199,100%,45%)] hover:shadow-[0_2px_0_0_hsl(199,100%,45%)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar 🚀"}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs font-semibold text-muted-foreground">
        Feito com 💙 por XTRI
      </p>
    </div>
  );
}
