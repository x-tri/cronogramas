import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PerfilAprovados } from "./types";

interface Props {
  perfil: PerfilAprovados;
  notaAluno: number;
}

export function SectionPerfilAprovados({ perfil, notaAluno }: Props) {
  const range = perfil.notaMaxima - perfil.notaMinima || 1;
  const pos = (v: number) => ((v - perfil.notaMinima) / range) * 100;
  const alunoPos = Math.max(0, Math.min(100, pos(notaAluno)));

  const markers = [
    { label: "Mín", value: perfil.notaMinima, pct: pos(perfil.notaMinima) },
    { label: "P25", value: perfil.notaP25, pct: pos(perfil.notaP25) },
    { label: "Mediana", value: perfil.notaMediana, pct: pos(perfil.notaMediana) },
    { label: "P75", value: perfil.notaP75, pct: pos(perfil.notaP75) },
    { label: "Máx", value: perfil.notaMaxima, pct: pos(perfil.notaMaxima) },
  ];

  return (
    <div className="rounded-xl bg-muted/50 p-3.5">
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        Perfil dos Aprovados ({perfil.ano} · {perfil.modalidade})
      </h4>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-black text-primary">{perfil.totalAprovados}</span>
        <span className="text-[10px] font-bold text-muted-foreground">aprovados analisados</span>
      </div>

      {/* Boxplot visual */}
      <div className="relative h-16 mb-2">
        {/* Whisker line */}
        <div className="absolute top-6 h-0.5 bg-muted-foreground/30" style={{ left: `${pos(perfil.notaMinima)}%`, right: `${100 - pos(perfil.notaMaxima)}%` }} />
        
        {/* IQR box */}
        <div
          className="absolute top-3 h-6 rounded-md bg-primary/20 border-2 border-primary/40"
          style={{ left: `${pos(perfil.notaP25)}%`, width: `${pos(perfil.notaP75) - pos(perfil.notaP25)}%` }}
        />

        {/* Median line */}
        <div className="absolute top-2.5 w-0.5 h-7 bg-primary" style={{ left: `${pos(perfil.notaMediana)}%` }} />

        {/* Aluno marker */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${alunoPos}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-[8px] font-black text-destructive whitespace-nowrap">Você</span>
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <div className="w-0.5 h-4 bg-destructive/60" />
        </div>

        {/* Labels */}
        <div className="absolute top-12 left-0 right-0 flex justify-between">
          {markers.map((m) => (
            <div key={m.label} className="text-center" style={{ position: "absolute", left: `${m.pct}%`, transform: "translateX(-50%)" }}>
              <p className="text-[8px] font-bold text-muted-foreground">{m.value.toFixed(0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
