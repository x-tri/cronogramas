import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Desperdicio, AREA_COLORS } from "./types";

interface Props {
  totalDesperdicios: number;
  desperdicios: Desperdicio[];
}

export function SectionDesperdicios({ totalDesperdicios, desperdicios }: Props) {
  return (
    <div className="rounded-xl bg-muted/50 p-3.5">
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        Desperdícios ({totalDesperdicios})
      </h4>

      {desperdicios.length === 0 ? (
        <div className="text-center py-3">
          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-1" />
          <p className="text-xs font-bold text-emerald-600">Nenhum desperdício identificado ✅</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Você não errou questões fáceis!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {desperdicios.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2">
              <Badge className={cn("text-[9px] font-black rounded-md border px-1.5 py-0.5", AREA_COLORS[d.area] || AREA_COLORS.CH)}>
                {d.area}
              </Badge>
              <span className="text-xs font-bold text-foreground">Q{d.questionNumber}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{d.classificacao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
