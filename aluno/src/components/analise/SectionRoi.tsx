import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoiArea, AREA_COLORS } from "./types";

interface Props {
  roiAreas: RoiArea[];
}

export function SectionRoi({ roiAreas }: Props) {
  const sorted = [...roiAreas].sort((a, b) => b.valorPontoFinal - a.valorPontoFinal);
  const maxVal = Math.max(...sorted.map((r) => r.valorPontoFinal), 0.01);

  return (
    <div className="rounded-xl bg-muted/50 p-3.5">
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        Onde Investir (ROI por Área)
      </h4>
      <div className="space-y-2">
        {sorted.map((r, i) => (
          <div key={r.sigla} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-[9px] font-black rounded-md border px-1.5 py-0.5 min-w-[36px] justify-center", AREA_COLORS[r.sigla] || AREA_COLORS.CH)}>
                {r.sigla}
              </Badge>
              <span className="text-xs font-bold text-foreground flex-1 truncate">{r.area}</span>
              <span className="text-[10px] font-black text-muted-foreground">
                Peso {r.peso} · <span className="text-primary">{r.valorPontoFinal.toFixed(2)} pts/ponto</span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-700 ease-out"
                style={{ width: `${(r.valorPontoFinal / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
