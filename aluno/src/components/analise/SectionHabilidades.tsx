import { Flame, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HabilidadeCritica, AREA_COLORS } from "./types";
import { SectionQuestoes } from "./SectionQuestoes";
import { useState } from "react";

interface Props {
  habilidades: HabilidadeCritica[];
}

export function SectionHabilidades({ habilidades }: Props) {
  const sorted = [...habilidades].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div>
      <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-destructive" />
        Habilidades Críticas
      </h4>
      <div className="space-y-2">
        {sorted.map((hab, i) => (
          <HabilidadeCard key={hab.identificador || i} hab={hab} index={i} />
        ))}
      </div>
    </div>
  );
}

function HabilidadeCard({ hab, index }: { hab: HabilidadeCritica; index: number }) {
  const [showQuestoes, setShowQuestoes] = useState(false);
  const colorClass = AREA_COLORS[hab.area || ""] || AREA_COLORS.CH;
  const hasQuestoes = hab.questoesRecomendadas && hab.questoesRecomendadas.length > 0;

  return (
    <div
      className="rounded-xl bg-muted/40 overflow-hidden animate-fade-in"
      style={{ animationDelay: `${0.1 + index * 0.05}s`, animationFillMode: "both" }}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge className={cn("text-[9px] font-black rounded-md border px-1.5 py-0.5", colorClass)}>
            {hab.identificador || hab.area || "—"}
          </Badge>
          <span className="text-xs font-bold text-foreground truncate flex-1">
            {hab.pedagogicalLabel || "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-destructive" />
            {hab.totalErros ?? 0} erros
          </span>
          <span>📊 {hab.percentualIncidencia != null ? `${hab.percentualIncidencia.toFixed(1)}%` : "—"} ENEM</span>
          {hasQuestoes && (
            <button
              onClick={() => setShowQuestoes(!showQuestoes)}
              className="flex items-center gap-0.5 text-primary font-bold ml-auto"
            >
              📝 {hab.questoesRecomendadas.length} questões
              {showQuestoes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {showQuestoes && hasQuestoes && (
        <SectionQuestoes
          questoes={hab.questoesRecomendadas}
          titulo={`${hab.identificador} — ${hab.pedagogicalLabel}`}
        />
      )}
    </div>
  );
}
