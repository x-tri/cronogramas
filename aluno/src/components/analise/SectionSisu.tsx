import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  notaPonderadaAtual: number;
  notaCorte: number;
  gap: number;
}

export function SectionSisu({ notaPonderadaAtual, notaCorte, gap }: Props) {
  const isPositive = gap >= 0;

  return (
    <div className="rounded-xl bg-muted/50 p-3.5">
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5" />
        Simulação SISU
      </h4>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-primary">{notaPonderadaAtual.toFixed(1)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">Sua Nota</p>
        </div>
        <div>
          <p className="text-lg font-black text-foreground">{notaCorte.toFixed(1)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">Nota de Corte</p>
        </div>
        <div>
          <p className={cn("text-lg font-black", isPositive ? "text-[hsl(var(--success))]" : "text-destructive")}>
            {isPositive ? "+" : ""}{gap.toFixed(1)}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground">Gap</p>
        </div>
      </div>
      <div className="mt-3 relative">
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              isPositive
                ? "bg-gradient-to-r from-[hsl(var(--success))] to-emerald-400"
                : "bg-gradient-to-r from-destructive to-rose-400"
            )}
            style={{ width: `${Math.min((notaPonderadaAtual / Math.max(notaCorte, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
