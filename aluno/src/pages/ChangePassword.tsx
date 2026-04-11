import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import logoXtri from "@/assets/logo-xtri.png";

interface Props {
  onComplete: () => void;
}

export default function ChangePassword({ onComplete }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres. 🔑");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem. 🤔");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Erro ao atualizar senha. Tente novamente. 😕");
      setSubmitting(false);
      return;
    }
    await supabase.rpc("mark_password_changed");
    setSubmitting(false);
    onComplete();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-accent/10 via-background to-primary/5 px-4">
      <div className="animate-bounce-in mb-6 flex flex-col items-center">
        <div className="animate-float mb-4">
          <img src={logoXtri} alt="XTRI" className="h-16 w-16 drop-shadow-lg" />
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mb-2">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Nova Senha</h1>
        <p className="text-sm font-semibold text-muted-foreground mt-1">
          Defina sua senha para começar! 🔐
        </p>
      </div>

      <div className="w-full max-w-sm animate-bounce-in" style={{ animationDelay: "0.15s" }}>
        <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-[0_8px_30px_-12px_hsl(var(--accent)/0.25)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-bold">🔑 Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={72}
                className="h-12 rounded-xl border-2 text-base font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-bold">✅ Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                maxLength={72}
                className="h-12 rounded-xl border-2 text-base font-semibold"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-center">
                <p className="text-sm font-bold text-destructive">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-black uppercase tracking-wide bg-accent text-accent-foreground shadow-[0_4px_0_0_hsl(14,100%,45%)] hover:shadow-[0_2px_0_0_hsl(14,100%,45%)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all hover:bg-accent/90"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar 💪"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
