import { useMemo } from "react";
import {
  useStudentProfile,
  useAnalysisRuns,
  useAlerts,
  usePlanItems,
  useAllBlocos,
} from "@/hooks/useStudentData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  Target,
  Brain,
  BookOpen,
  CheckCircle2,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AREA_CONFIG: Record<string, { label: string; emoji: string; gradient: string; ring: string }> = {
  LC: { label: "Linguagens", emoji: "📝", gradient: "from-rose-400 to-rose-600", ring: "text-rose-500" },
  CH: { label: "Humanas", emoji: "🌍", gradient: "from-sky-400 to-sky-600", ring: "text-sky-500" },
  CN: { label: "Natureza", emoji: "🔬", gradient: "from-emerald-400 to-emerald-600", ring: "text-emerald-500" },
  MT: { label: "Matemática", emoji: "📐", gradient: "from-violet-400 to-violet-600", ring: "text-violet-500" },
};

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {value}{suffix}
    </span>
  );
}

function CircularProgress({ percent, size = 72, strokeWidth = 6, color }: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={cn("transition-all duration-1000 ease-out", color)}
      />
    </svg>
  );
}

export default function Desempenho() {
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: runs, isLoading: loadingRuns } = useAnalysisRuns(studentKey);
  const { data: alerts, isLoading: loadingAlerts } = useAlerts(studentKey);
  const { data: planItems, isLoading: loadingPlan } = usePlanItems(studentKey);
  const { data: allData, isLoading: loadingBlocos } = useAllBlocos(student?.id, student?.matricula);

  const isLoading = loadingRuns || loadingAlerts || loadingPlan || loadingBlocos;

  // Compute stats
  const stats = useMemo(() => {
    if (!allData) return null;
    const { cronogramas, blocos } = allData;
    const totalBlocos = blocos.length;
    const concluidos = blocos.filter((b) => b.concluido).length;
    const uniqueTopics = new Set(blocos.map((b) => b.titulo)).size;
    const weeksStudied = cronogramas.length;

    // Weekly breakdown for chart
    const weeklyData = cronogramas.map((c) => {
      const weekBlocos = blocos.filter((b) => b.cronograma_id === c.id);
      const weekDone = weekBlocos.filter((b) => b.concluido).length;
      return {
        week: new Date(c.semana_inicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        total: weekBlocos.length,
        done: weekDone,
        percent: weekBlocos.length > 0 ? Math.round((weekDone / weekBlocos.length) * 100) : 0,
      };
    });

    return { totalBlocos, concluidos, uniqueTopics, weeksStudied, weeklyData };
  }, [allData]);

  // Group plan items by area
  const areaBreakdown = useMemo(() => {
    if (!planItems) return [];
    const map: Record<string, { area: string; topics: string[]; level: string }> = {};
    for (const item of planItems) {
      const area = (item as any).content_topics?.area_sigla || item.fallback_area_sigla || "?";
      const label = (item as any).content_topics?.canonical_label || item.fallback_label || "—";
      if (!map[area]) map[area] = { area, topics: [], level: item.expected_level };
      map[area].topics.push(label);
    }
    return Object.values(map).sort((a, b) => b.topics.length - a.topics.length);
  }, [planItems]);

  const latestRun = runs?.[0];

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const completionPercent = stats ? (stats.totalBlocos > 0 ? Math.round((stats.concluidos / stats.totalBlocos) * 100) : 0) : 0;

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Hero KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Blocos Feitos"
          value={stats?.concluidos ?? 0}
          total={stats?.totalBlocos}
          color="text-[hsl(var(--success))]"
          bgColor="bg-[hsl(var(--success))]/10"
          delay={0}
        />
        <KPICard
          icon={<BookOpen className="h-5 w-5" />}
          label="Tópicos Únicos"
          value={stats?.uniqueTopics ?? 0}
          color="text-primary"
          bgColor="bg-primary/10"
          delay={1}
        />
        <KPICard
          icon={<Flame className="h-5 w-5" />}
          label="Semanas"
          value={stats?.weeksStudied ?? 0}
          suffix=" sem."
          color="text-accent"
          bgColor="bg-accent/10"
          delay={2}
        />
        <KPICard
          icon={<Zap className="h-5 w-5" />}
          label="Conclusão"
          value={completionPercent}
          suffix="%"
          color="text-[hsl(var(--secondary))]"
          bgColor="bg-[hsl(var(--secondary))]/10"
          delay={3}
        />
      </div>

      {/* Weekly Progress Timeline */}
      {stats && stats.weeklyData.length > 0 && (
        <div className="rounded-2xl border-2 bg-card p-4 animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
          <h3 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            Progresso Semanal
          </h3>
          <div className="flex items-end gap-2 h-28">
            {stats.weeklyData.map((w, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
                style={{ animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: "both" }}
              >
                <span className="text-[9px] font-black text-muted-foreground">{w.done}/{w.total}</span>
                <div className="w-full bg-muted rounded-full overflow-hidden relative" style={{ height: "80px" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-primary to-primary/60 transition-all duration-1000 ease-out"
                    style={{ height: `${Math.max(w.percent, 4)}%` }}
                  />
                </div>
                <span className="text-[8px] font-bold text-muted-foreground leading-tight text-center">{w.week}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Area Breakdown - Topic Tree */}
      {areaBreakdown.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
          <h3 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-3">
            <Target className="h-4 w-4 text-accent" />
            Mapa de Conteúdos
          </h3>
          <div className="space-y-3">
            {areaBreakdown.map((area, areaIdx) => {
              const config = AREA_CONFIG[area.area] || { label: area.area, emoji: "📋", gradient: "from-gray-400 to-gray-600", ring: "text-gray-500" };
              return (
                <div
                  key={area.area}
                  className="rounded-2xl border-2 bg-card overflow-hidden"
                  style={{ animationDelay: `${0.5 + areaIdx * 0.1}s`, animationFillMode: "both" }}
                >
                  {/* Area Header */}
                  <div className={cn("bg-gradient-to-r p-3 flex items-center justify-between", config.gradient)}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className="text-sm font-black text-white">{config.label}</span>
                    </div>
                    <Badge className="bg-white/25 text-white border-0 text-[10px] font-black backdrop-blur-sm">
                      {area.topics.length} tópicos
                    </Badge>
                  </div>
                  {/* Topic Tree */}
                  <div className="p-3">
                    {area.topics.map((topic, topicIdx) => (
                      <div
                        key={topicIdx}
                        className="flex items-start gap-2 py-1.5 animate-fade-in"
                        style={{ animationDelay: `${0.6 + areaIdx * 0.1 + topicIdx * 0.05}s`, animationFillMode: "both" }}
                      >
                        {/* Tree connector */}
                        <div className="flex flex-col items-center flex-shrink-0 w-5">
                          <div className={cn("h-2 w-0.5 bg-muted", topicIdx === 0 && "invisible")} />
                          <div className={cn("h-2.5 w-2.5 rounded-full border-2 flex-shrink-0", config.ring, "border-current bg-card")} />
                          <div className={cn("h-full w-0.5 bg-muted flex-1", topicIdx === area.topics.length - 1 && "invisible")} />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 py-0.5">
                          <span className="text-xs font-bold text-foreground truncate">{topic}</span>
                          <Badge variant="outline" className="text-[9px] font-black flex-shrink-0 rounded-lg ml-auto">
                            {area.level}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mentor Analysis */}
      {latestRun && (
        <div className="rounded-2xl border-2 bg-card p-4 animate-fade-in" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
          <h3 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-3">
            <Brain className="h-4 w-4 text-accent" />
            Análise do Mentor
          </h3>

          {/* Mastery Rings */}
          <div className="flex justify-center gap-8 mb-4">
            <div className="flex flex-col items-center">
              <div className="relative">
                <CircularProgress
                  percent={Number(latestRun.avg_mastery_planned) * 100}
                  color="text-primary"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-primary">
                    {(Number(latestRun.avg_mastery_planned) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground mt-1">Planejado</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative">
                <CircularProgress
                  percent={Number(latestRun.avg_mastery_critical) * 100}
                  color="text-accent"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-accent">
                    {(Number(latestRun.avg_mastery_critical) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground mt-1">Crítico</span>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-black mb-2">
              {latestRun.overall_status === "sem_dados" ? "📊 Primeiras análises" : latestRun.overall_status}
            </Badge>
            <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
              {latestRun.briefing}
            </p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: "0.7s", animationFillMode: "both" }}>
          <h3 className="text-sm font-black mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-accent" />
            Pontos de Atenção ({alerts.length})
          </h3>
          <div className="space-y-2.5">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border-2 bg-card p-3 flex items-start gap-2.5"
              >
                <Badge
                  className={cn(
                    "text-[10px] font-black border-0 flex-shrink-0 mt-0.5",
                    alert.severity === "critical"
                      ? "bg-destructive/15 text-destructive"
                      : alert.severity === "high"
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary/30 text-secondary-foreground"
                  )}
                >
                  {alert.severity === "critical" ? "🚨" : alert.severity === "high" ? "⚠️" : "💡"} {alert.severity}
                </Badge>
                <p className="text-xs font-semibold text-foreground">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!stats?.totalBlocos && !latestRun && !planItems?.length && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-bounce-in">
          <div className="text-5xl mb-4 animate-float">📊</div>
          <p className="text-lg font-black text-foreground">Sua evolução aparece aqui!</p>
          <p className="text-sm font-semibold text-muted-foreground mt-1">
            Continue estudando para ver seus resultados 💪
          </p>
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  total,
  suffix = "",
  color,
  bgColor,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  suffix?: string;
  color: string;
  bgColor: string;
  delay: number;
}) {
  return (
    <div
      className="rounded-2xl border-2 bg-card p-4 flex flex-col items-center text-center animate-fade-in"
      style={{ animationDelay: `${delay * 0.08}s`, animationFillMode: "both" }}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-2", bgColor, color)}>
        {icon}
      </div>
      <p className={cn("text-2xl font-black", color)}>
        <AnimatedNumber value={value} suffix={suffix} />
      </p>
      {total !== undefined && (
        <p className="text-[10px] font-bold text-muted-foreground">de {total}</p>
      )}
      <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
