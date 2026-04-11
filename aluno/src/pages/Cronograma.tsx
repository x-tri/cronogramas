import { useState, useMemo } from "react";
import { useStudentProfile, useCronogramas, useBlocos } from "@/hooks/useStudentData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Check, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const DIAS_LABEL: Record<string, string> = {
  segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta",
  sexta: "Sexta", sabado: "Sábado", domingo: "Domingo",
};
const TIPO_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  estudo: { bg: "bg-primary/10", border: "border-l-primary", icon: "📖" },
  revisão: { bg: "bg-[hsl(45,100%,92%)]", border: "border-l-[hsl(var(--secondary))]", icon: "🔄" },
  revisao: { bg: "bg-[hsl(45,100%,92%)]", border: "border-l-[hsl(var(--secondary))]", icon: "🔄" },
  simulado: { bg: "bg-purple-50", border: "border-l-purple-400", icon: "🎯" },
  rotina: { bg: "bg-[hsl(145,30%,92%)]", border: "border-l-[hsl(var(--success))]", icon: "⏰" },
};

export default function Cronograma() {
  const { data: student, isLoading: loadingStudent } = useStudentProfile();
  const { data: cronogramas, isLoading: loadingCron } = useCronogramas(student?.id, student?.matricula);
  const [cronIndex, setCronIndex] = useState(0);

  const activeCron = cronogramas?.[cronIndex];
  const { data: blocos, isLoading: loadingBlocos } = useBlocos(activeCron?.id);
  const queryClient = useQueryClient();

  const blocosByDay = useMemo(() => {
    if (!blocos) return {};
    const map: Record<string, typeof blocos> = {};
    for (const b of blocos) {
      (map[b.dia_semana] ??= []).push(b);
    }
    return map;
  }, [blocos]);

  const completedCount = blocos?.filter((b) => b.concluido).length ?? 0;
  const totalCount = blocos?.length ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleConcluido = async (blocoId: string, current: boolean) => {
    await supabase
      .from("blocos_cronograma")
      .update({ concluido: !current })
      .eq("id", blocoId);
    queryClient.invalidateQueries({ queryKey: ["blocos", activeCron?.id] });
  };

  if (loadingStudent || loadingCron) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (!cronogramas?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-bounce-in">
        <div className="text-5xl mb-4 animate-float">📅</div>
        <p className="text-lg font-black text-foreground">Nenhum cronograma ainda!</p>
        <p className="text-sm font-semibold text-muted-foreground mt-1">
          Seu coordenador vai gerar em breve 🚀
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          disabled={cronIndex >= (cronogramas?.length ?? 1) - 1}
          onClick={() => setCronIndex((i) => i + 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-black text-foreground">
            {activeCron?.semana_inicio && new Date(activeCron.semana_inicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            {" — "}
            {activeCron?.semana_fim && new Date(activeCron.semana_fim + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          disabled={cronIndex <= 0}
          onClick={() => setCronIndex((i) => i - 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mb-5 rounded-2xl border-2 bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-foreground flex items-center gap-1">
            <Trophy className="h-4 w-4 text-accent" />
            Progresso da Semana
          </span>
          <span className="text-xs font-black text-primary">{completedCount}/{totalCount}</span>
        </div>
        <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent === 100 && totalCount > 0 && (
          <p className="text-center text-xs font-black text-accent mt-2 animate-pop">
            🎉 Semana completa! Parabéns!
          </p>
        )}
      </div>

      {loadingBlocos ? (
        [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full mb-3 rounded-2xl" />)
      ) : (
        DIAS.map((dia) => {
          const dayBlocos = blocosByDay[dia];
          if (!dayBlocos?.length) return null;
          const dayCompleted = dayBlocos.filter(b => b.concluido).length;
          const dayTotal = dayBlocos.length;
          return (
            <div key={dia} className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">{DIAS_LABEL[dia] || dia}</h3>
                {dayCompleted === dayTotal && dayTotal > 0 && (
                  <Badge className="bg-accent/15 text-accent border-0 text-[10px] font-black">
                    <Star className="h-3 w-3 mr-0.5" /> Completo!
                  </Badge>
                )}
              </div>
              <div className="space-y-2.5">
                {dayBlocos.map((b, idx) => {
                  const style = TIPO_STYLES[b.tipo?.toLowerCase()] || { bg: "bg-muted", border: "border-l-border", icon: "📋" };
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "rounded-2xl border-2 border-l-[5px] p-3 transition-all",
                        style.bg,
                        style.border,
                        b.concluido && "opacity-60 scale-[0.98]"
                      )}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-black flex items-center gap-1.5", b.concluido && "line-through opacity-70")}>
                            <span>{style.icon}</span>
                            {b.titulo}
                          </p>
                          <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                            🕐 {b.horario_inicio} – {b.horario_fim} • {b.turno}
                          </p>
                          {b.descricao && (
                            <p className="text-[11px] font-semibold text-muted-foreground mt-1">{b.descricao}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleConcluido(b.id, !!b.concluido)}
                          className={cn(
                            "flex-shrink-0 h-9 w-9 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90",
                            b.concluido
                              ? "bg-[hsl(var(--success))] border-[hsl(var(--success))] text-white shadow-[0_3px_0_0_hsl(145,65%,35%)]"
                              : "border-muted-foreground/30 hover:border-primary hover:bg-primary/10 shadow-[0_3px_0_0_hsl(var(--border))]"
                          )}
                        >
                          {b.concluido && <Check className="h-5 w-5" strokeWidth={3} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
