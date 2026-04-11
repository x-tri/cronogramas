import { useStudentProfile, useAlerts } from "@/hooks/useStudentData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SEVERITY_CONFIG: Record<string, { emoji: string; border: string; bg: string; badgeBg: string; badgeText: string }> = {
  critical: { emoji: "🚨", border: "border-l-destructive", bg: "bg-destructive/5", badgeBg: "bg-destructive/15", badgeText: "text-destructive" },
  high: { emoji: "⚠️", border: "border-l-accent", bg: "bg-accent/5", badgeBg: "bg-accent/15", badgeText: "text-accent" },
  warning: { emoji: "💡", border: "border-l-[hsl(var(--secondary))]", bg: "bg-[hsl(45,100%,95%)]", badgeBg: "bg-[hsl(45,100%,85%)]", badgeText: "text-[hsl(35,60%,30%)]" },
  medium: { emoji: "💡", border: "border-l-[hsl(var(--secondary))]", bg: "bg-[hsl(45,100%,95%)]", badgeBg: "bg-[hsl(45,100%,85%)]", badgeText: "text-[hsl(35,60%,30%)]" },
  low: { emoji: "💬", border: "border-l-primary", bg: "bg-primary/5", badgeBg: "bg-primary/15", badgeText: "text-primary" },
  info: { emoji: "💬", border: "border-l-primary", bg: "bg-primary/5", badgeBg: "bg-primary/15", badgeText: "text-primary" },
};

export default function Avisos() {
  const { data: student } = useStudentProfile();
  const { data: alerts, isLoading } = useAlerts(student?.matricula || student?.id);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (!alerts?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-bounce-in">
        <div className="text-5xl mb-4 animate-float">🎉</div>
        <p className="text-lg font-black text-foreground">Tudo certo!</p>
        <p className="text-sm font-semibold text-muted-foreground mt-1">
          Nenhum aviso no momento. Continue assim! 🌟
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
        🔔 Avisos ({alerts.length})
      </h2>
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
        return (
          <div
            key={alert.id}
            className={`rounded-2xl border-2 border-l-[5px] ${config.border} ${config.bg} p-3.5`}
          >
            <div className="flex items-start gap-2.5">
              <Badge className={`${config.badgeBg} ${config.badgeText} border-0 text-[10px] font-black flex-shrink-0 mt-0.5`}>
                {config.emoji} {alert.severity}
              </Badge>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground">{alert.alert_type}</p>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">{alert.message}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-1.5">
                  📅 {new Date(alert.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
