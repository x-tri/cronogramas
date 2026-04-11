import { useStudentProfile } from "@/hooks/useStudentData";
import { useNotifications, type StudentNotification } from "@/hooks/useNotifications";
import { useGamification } from "@/hooks/useGamification";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Zap, Flame, ArrowRight, Trophy } from "lucide-react";

const COLOR_MAP = {
  primary: {
    bg: "bg-primary/5",
    border: "border-l-primary",
    badge: "bg-primary/15 text-primary",
    button: "bg-primary text-white hover:bg-primary/90",
    progress: "bg-primary",
    progressTrack: "bg-primary/15",
  },
  accent: {
    bg: "bg-accent/5",
    border: "border-l-accent",
    badge: "bg-accent/15 text-accent",
    button: "bg-accent text-white hover:bg-accent/90",
    progress: "bg-accent",
    progressTrack: "bg-accent/15",
  },
  success: {
    bg: "bg-emerald-500/5",
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600",
    button: "bg-emerald-500 text-white hover:bg-emerald-600",
    progress: "bg-emerald-500",
    progressTrack: "bg-emerald-500/15",
  },
} as const;

const LEVEL_COLORS = ["", "text-muted-foreground", "text-primary", "text-emerald-500", "text-violet-500", "text-amber-500"];
const LEVEL_BG = ["", "bg-muted", "bg-primary/10", "bg-emerald-500/10", "bg-violet-500/10", "bg-amber-500/10"];

export default function Avisos() {
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: notifications, isLoading } = useNotifications(studentKey);
  const { data: gamification } = useGamification(studentKey);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  const level = gamification?.level ?? 1;
  const xp = gamification?.xp_total ?? 0;
  const title = gamification?.title ?? "Calouro";
  const streak = gamification?.streak_weeks ?? 0;
  const xpNext = gamification?.xp_next_level ?? 100;
  const xpBase = level === 1 ? 0 : level === 2 ? 100 : level === 3 ? 300 : level === 4 ? 600 : 1000;
  const xpProgress = Math.min(Math.round(((xp - xpBase) / Math.max(xpNext - xpBase, 1)) * 100), 100);

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">

      {/* XP Status Card */}
      <div className="rounded-2xl border-2 bg-card p-4 animate-bounce-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", LEVEL_BG[level])}>
              <Trophy className={cn("h-5 w-5", LEVEL_COLORS[level])} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{title}</p>
              <p className="text-[10px] font-bold text-muted-foreground">Nível {level}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-accent/10 px-2.5 py-1">
              <Flame className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-black text-accent">{streak}</span>
            </div>
            <div className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-black text-primary">{xp}</span>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-muted-foreground">{xp} XP</span>
            <span className="text-[9px] font-bold text-muted-foreground">{xpNext} XP</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", LEVEL_COLORS[level] ? `bg-current ${LEVEL_COLORS[level]}` : "bg-primary")}
              style={{ width: `${Math.max(xpProgress, 2)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Feed de Notificações */}
      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
            Pra você hoje
          </h2>
          {notifications.map((notif, idx) => (
            <NotificationCard key={notif.type} notification={notif} index={idx} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-bounce-in">
          <div className="text-5xl mb-3 animate-float">🌟</div>
          <p className="text-lg font-black text-foreground">Tudo em dia!</p>
          <p className="text-sm font-semibold text-muted-foreground mt-1">
            Continue estudando e suas conquistas aparecerão aqui.
          </p>
        </div>
      )}

      {/* XP Guide */}
      <div className="rounded-2xl border-2 border-dashed bg-card/50 p-4 animate-fade-in" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2.5">
          Como ganhar XP
        </p>
        <div className="space-y-2">
          {[
            { emoji: "✅", label: "Completar bloco de estudo", xp: "+10" },
            { emoji: "🎯", label: "Acertar questão ENEM", xp: "+20" },
            { emoji: "📝", label: "Responder questão (errar)", xp: "+5" },
            { emoji: "⭐", label: "Bloco de alta prioridade", xp: "+15" },
            { emoji: "🏆", label: "Completar semana inteira", xp: "+100" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <span>{item.emoji}</span> {item.label}
              </span>
              <span className="text-[11px] font-black text-primary">{item.xp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationCard({ notification, index }: { notification: StudentNotification; index: number }) {
  const navigate = useNavigate();
  const colors = COLOR_MAP[notification.color] ?? COLOR_MAP.primary;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-l-[5px] p-4 space-y-2.5 animate-fade-in",
        colors.border,
        colors.bg,
      )}
      style={{ animationDelay: `${index * 0.1}s`, animationFillMode: "both" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 animate-pop" style={{ animationDelay: `${0.2 + index * 0.1}s`, animationFillMode: "both" }}>
          {notification.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground leading-tight">
            {notification.title}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5 leading-relaxed">
            {notification.message}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {notification.progress !== undefined && (
        <div className="space-y-1">
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", colors.progress)}
              style={{ width: `${Math.max(notification.progress, 2)}%` }}
            />
          </div>
          <p className="text-[9px] font-black text-muted-foreground text-right">{notification.progress}%</p>
        </div>
      )}

      {/* CTA Button */}
      {notification.action_label && notification.action_route && (
        <button
          onClick={() => navigate(notification.action_route!)}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black shadow-sm transition-all active:scale-[0.98]",
            colors.button,
          )}
        >
          {notification.action_label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
