import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, CheckCircle2, LogOut } from "lucide-react";
import logoXtri from "@/assets/logo-xtri.png";

interface LinkResult {
  readonly success: boolean;
  readonly error?: string;
  readonly student_name?: string;
  readonly matricula?: string;
  readonly turma?: string;
  readonly already_linked?: boolean;
}

interface LinkMatriculaProps {
  readonly onLinked: () => void;
}

export default function LinkMatricula({ onLinked }: LinkMatriculaProps) {
  const { user, signOut } = useAuth();
  const [matricula, setMatricula] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linked, setLinked] = useState<LinkResult | null>(null);

  const userEmail = user?.email ?? user?.user_metadata?.email ?? "";
  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "";
  const userAvatar = user?.user_metadata?.avatar_url ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const trimmed = matricula.trim();
    if (!trimmed) {
      setError("Digite sua matrícula.");
      setSubmitting(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("link_google_to_student", {
      p_matricula: trimmed,
    });

    if (rpcError) {
      setError("Erro ao vincular. Tente novamente.");
      setSubmitting(false);
      return;
    }

    const result = data as LinkResult;
    if (!result.success) {
      setError(result.error === "Matrícula não encontrada"
        ? "Matrícula não encontrada. Verifique o número com seu coordenador."
        : result.error ?? "Erro desconhecido.");
      setSubmitting(false);
      return;
    }

    setLinked(result);
    setSubmitting(false);

    // Redirecionar após 2s de celebração
    setTimeout(() => onLinked(), 2000);
  };

  // Tela de sucesso
  if (linked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-accent/5 px-4">
        <div className="animate-bounce-in flex flex-col items-center text-center">
          <div className="animate-pop mb-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-1">Conta vinculada!</h1>
          <p className="text-sm font-semibold text-muted-foreground mb-4">
            {linked.student_name} — Turma {linked.turma}
          </p>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2">
            <span className="text-sm font-bold text-emerald-600">
              Matrícula {linked.matricula} conectada ao Google
            </span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-4 animate-pulse">
            Entrando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-accent/5 px-4">
      {/* Header */}
      <div className="animate-bounce-in mb-6 flex flex-col items-center">
        <img src={logoXtri} alt="XTRI" className="h-16 w-16 mb-3 drop-shadow-lg" />
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Vincular sua conta
        </h1>
        <p className="text-sm font-semibold text-muted-foreground mt-1 text-center max-w-xs">
          Conecte seu Google à sua matrícula para acessar seus dados
        </p>
      </div>

      {/* Google profile */}
      <div className="w-full max-w-sm animate-bounce-in mb-4" style={{ animationDelay: "0.1s" }}>
        <div className="rounded-2xl border-2 bg-card p-4 flex items-center gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="h-10 w-10 rounded-full border-2" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-black text-primary">{userName?.[0] ?? "?"}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground truncate">{userName || "Conta Google"}</p>
            <p className="text-[11px] font-semibold text-muted-foreground truncate">{userEmail}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Trocar conta" className="h-8 w-8 flex-shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Link form */}
      <div className="w-full max-w-sm animate-bounce-in" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-2xl border-2 bg-card p-6 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matricula" className="text-sm font-bold">
                🎓 Sua Matrícula
              </Label>
              <Input
                id="matricula"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 214140291"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                required
                autoFocus
                className="h-12 rounded-xl border-2 text-base font-semibold transition-all focus:border-primary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <p className="text-[10px] font-semibold text-muted-foreground">
                Digite o número de matrícula que seu coordenador forneceu
              </p>
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
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Vincular Conta
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold text-muted-foreground">
        Feito com 💙 por XTRI
      </p>
    </div>
  );
}
