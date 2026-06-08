import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import logoXtri from "@/assets/logo-xtri.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAllBlocos } from "@/hooks/useStudentData";
import { useGamification } from "@/hooks/useGamification";
import { useStudentPerformance } from "@/hooks/useStudentPerformance";
import {
  buildDailyActivity,
  buildHeatmapWeeks,
  computeActiveDays,
  computeStreaks,
  type HeatLevel,
} from "@/lib/activity";

const WEEKS = 17;

// One brand-blue ramp, matching the reference card. Empty days stay neutral gray.
const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/70",
  4: "bg-primary",
};

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface ActivityHeatmapStudent {
  id: string;
  matricula: string | null;
  name: string | null;
  turma: string | null;
}

interface ActivityHeatmapCardProps {
  student: ActivityHeatmapStudent | null | undefined;
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-xl font-black leading-none text-foreground">{value}</span>
      <span className="mt-1 text-[10px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

export function ActivityHeatmapCard({ student }: ActivityHeatmapCardProps) {
  const studentId = student?.id;
  const studentKey = student?.matricula || student?.id;

  const blocosQuery = useAllBlocos(studentId, student?.matricula);
  const performanceQuery = useStudentPerformance(studentId);
  const gamification = useGamification(studentKey);

  // Date-keyed memo: stable within a day (keeps the heavy memos below cached)
  // but re-derives if the page is left open across midnight.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const today = useMemo(() => parseISO(todayKey), [todayKey]);

  const daily = useMemo(
    () =>
      buildDailyActivity({
        blocos: blocosQuery.data?.blocos ?? [],
        cronogramas: blocosQuery.data?.cronogramas ?? [],
        // Simulados are an enhancement — if the edge function errors, we still
        // render the blocos-based heatmap instead of failing.
        simulados: performanceQuery.data?.performances ?? [],
      }),
    [blocosQuery.data, performanceQuery.data],
  );

  const weeks = useMemo(() => buildHeatmapWeeks(daily, { weeks: WEEKS, today }), [daily, today]);
  const activeDays = useMemo(() => computeActiveDays(daily), [daily]);
  const streaks = useMemo(() => computeStreaks(daily, today), [daily, today]);

  const xp = gamification.data?.xp_total ?? 0;
  const isEmpty = daily.size === 0;

  if (!student) return null;

  if (blocosQuery.isLoading) {
    return (
      <div className="mb-5 rounded-2xl border-2 bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
        <Skeleton className="mt-4 h-20 w-full rounded-xl" />
        <Skeleton className="mt-4 h-8 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border-2 bg-card p-4 animate-fade-in">
      {/* Header — avatar + name + turma, brand logo on the right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-xs font-black text-primary">
              {initials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight text-foreground">
              {student.name ?? "Aluno"}
            </p>
            <p className="truncate text-[11px] font-bold text-muted-foreground">
              {student.turma ? `Turma ${student.turma}` : "Meu progresso"}
            </p>
          </div>
        </div>
        <img src={logoXtri} alt="XTRI" className="h-7 w-7 flex-shrink-0" />
      </div>

      {/* Heatmap grid — 7 rows (Mon..Sun) × WEEKS columns, esticado p/ preencher a largura */}
      <div className="mt-4">
        <div className="flex gap-[3px]">
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-1 flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={
                    cell.isFuture
                      ? undefined
                      : `${cell.count} ${cell.count === 1 ? "atividade" : "atividades"} · ${format(
                          parseISO(cell.date),
                          "dd 'de' MMM",
                          { locale: ptBR },
                        )}`
                  }
                  className={cn(
                    "aspect-square w-full rounded-[3px]",
                    cell.isFuture ? "bg-muted/40" : LEVEL_CLASS[cell.level],
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend — plain-language hint for students new to this kind of chart */}
      <div className="mt-3 space-y-1.5">
        <p className="text-center text-[10px] font-bold leading-snug text-muted-foreground">
          Cada quadradinho é um dia. Quanto mais azul, mais você estudou (blocos + simulados).
        </p>
        <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground">
          <span>menos</span>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((lvl) => (
            <span key={lvl} className={cn("h-2.5 w-2.5 rounded-[2px]", LEVEL_CLASS[lvl])} />
          ))}
          <span>mais</span>
        </div>
      </div>

      {/* Stats — monochrome numbers like the reference */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t-2 pt-3">
        <Stat value={compact.format(xp)} label="XP total" />
        <Stat value={String(activeDays)} label="dias ativos" />
        <Stat value={String(streaks.current)} label="dias seguidos" />
        <Stat value={String(streaks.longest)} label="recorde de dias" />
      </div>

      {isEmpty && (
        <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground">
          Complete blocos e faça simulados para preencher seu mapa 🌱
        </p>
      )}
    </div>
  );
}
