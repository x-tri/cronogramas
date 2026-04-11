import { useMemo } from "react";
import { useStudentProfile, usePlanItems } from "@/hooks/useStudentData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const AREA_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  LC: { label: "Linguagens", emoji: "📝", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  CH: { label: "Humanas", emoji: "🌍", color: "text-sky-600", bg: "bg-sky-50 border-sky-200" },
  CN: { label: "Natureza", emoji: "🔬", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  MT: { label: "Matemática", emoji: "📐", color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
};

export default function Conteudos() {
  const { data: student } = useStudentProfile();
  const { data: items, isLoading } = usePlanItems(student?.matricula || student?.id);

  const grouped = useMemo(() => {
    if (!items) return {};
    const map: Record<string, typeof items> = {};
    for (const item of items) {
      const area = (item as any).content_topics?.area_sigla || item.fallback_area_sigla || "?";
      (map[area] ??= []).push(item);
    }
    return map;
  }, [items]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-bounce-in">
        <div className="text-5xl mb-4 animate-float">📚</div>
        <p className="text-lg font-black text-foreground">Conteúdos em breve!</p>
        <p className="text-sm font-semibold text-muted-foreground mt-1">
          Seus tópicos de estudo vão aparecer aqui 🎯
        </p>
      </div>
    );
  }

  const areas = Object.keys(grouped).sort();

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
      {areas.map((area) => {
        const config = AREA_CONFIG[area] || { label: area, emoji: "📋", color: "text-foreground", bg: "bg-muted border-border" };
        const areaItems = grouped[area];
        return (
          <div key={area} className={`rounded-2xl border-2 ${config.bg} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-black ${config.color} flex items-center gap-1.5`}>
                <span className="text-lg">{config.emoji}</span>
                {config.label}
              </h3>
              <Badge className="bg-card border-0 text-[10px] font-black text-muted-foreground">
                {areaItems.length} tópicos
              </Badge>
            </div>
            <div className="space-y-1.5">
              {areaItems.map((item, idx) => {
                const topic = (item as any).content_topics;
                const label = topic?.canonical_label || item.fallback_label || "—";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-card/80 p-2.5 border"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-[10px] font-black text-muted-foreground flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-foreground truncate">{label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black flex-shrink-0 rounded-lg">
                      {item.expected_level}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
