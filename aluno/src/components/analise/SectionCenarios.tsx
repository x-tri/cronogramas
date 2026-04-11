import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CenarioData } from "./types";

interface Props {
  cenarios: {
    otimista?: CenarioData;
    moderado?: CenarioData;
    conservador?: CenarioData;
  };
  notaCorte: number;
}

const CONFIG = [
  { key: "otimista" as const, emoji: "🚀", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  { key: "moderado" as const, emoji: "📈", color: "text-primary bg-primary/10 border-primary/30" },
  { key: "conservador" as const, emoji: "🛡️", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
];

export function SectionCenarios({ cenarios, notaCorte }: Props) {
  return (
    <div>
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Cenários de Projeção
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {CONFIG.map(({ key, emoji, color }) => {
          const c = cenarios[key];
          if (!c) return null;
          const falta = notaCorte - c.notaFinalEstimada;
          return (
            <div key={key} className={cn("rounded-xl border-2 p-2.5 text-center", color)}>
              <p className="text-sm mb-0.5">{emoji}</p>
              <p className="text-[9px] font-black uppercase tracking-wider mb-1 opacity-80">{c.nome || key}</p>
              <p className="text-lg font-black">{c.notaFinalEstimada?.toFixed(1)}</p>
              <p className="text-[9px] font-semibold opacity-70">
                {falta > 0 ? `Faltam ${falta.toFixed(1)}` : "Aprovado! ✅"}
              </p>
              {c.incrementoPorArea && (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {Object.entries(c.incrementoPorArea).map(([area, pts]) => (
                    <span key={area} className="text-[8px] font-bold bg-background/50 rounded px-1 py-0.5">
                      {area} +{pts}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {cenarios.moderado?.descricao && (
        <p className="text-[10px] text-muted-foreground mt-2 italic text-center">
          📌 Moderado: {cenarios.moderado.descricao}
        </p>
      )}
    </div>
  );
}
