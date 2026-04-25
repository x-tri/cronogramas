import { useStudentProfile } from "@/hooks/useStudentData";
import { useNotifications, type StudentNotification } from "@/hooks/useNotifications";
import { useGamification } from "@/hooks/useGamification";
import { useStudentPdfs, type StudentPdf } from "@/hooks/useStudentPdfs";
import { useSimuladosPendentes } from "@/hooks/useSimulados";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Zap, Flame, ArrowRight, FileText, Download, ClipboardList } from "lucide-react";
import { MascotWithBubble } from "@/components/MascotWithBubble";

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
  const { data: pdfs } = useStudentPdfs(studentKey);
  const { data: simulados } = useSimuladosPendentes();
  const simuladoPendente = simulados?.find((s) => !s.ja_respondeu) ?? null;
  const simuladoRespondido = simulados?.find((s) => s.ja_respondeu) ?? null;

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

      {/* Mascote + XP Status Card */}
      <div className="rounded-2xl border-2 bg-card overflow-hidden animate-bounce-in">
        {/* Mascote com speech bubble */}
        <div className="flex flex-col items-center pt-3 pb-2">
          <MascotWithBubble level={level} gamification={gamification} size={160} />
          <p className={cn("text-lg font-black mt-1", LEVEL_COLORS[level])}>{title}</p>
          <p className="text-[10px] font-bold text-muted-foreground">Nível {level} de 5</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-3 pb-3">
          <div className="flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1.5">
            <Flame className="h-4 w-4 text-accent" />
            <span className="text-xs font-black text-accent">{streak} sem.</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-primary">{xp} XP</span>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="px-4 pb-4 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-muted-foreground">{xp} XP</span>
            <span className="text-[9px] font-bold text-muted-foreground">{xpNext} XP</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", LEVEL_COLORS[level] ? `bg-current ${LEVEL_COLORS[level]}` : "bg-primary")}
              style={{ width: `${Math.max(xpProgress, 2)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Banner de simulado disponivel (Fase 4) */}
      {simuladoPendente && (
        <SimuladoBanner
          title={simuladoPendente.title}
          onClick={() =>
            (window.location.href = `/simulados/${simuladoPendente.id}/responder`)
          }
          ctaLabel="Preencher gabarito"
          tone="accent"
          caderno_url={simuladoPendente.caderno_url}
        />
      )}
      {!simuladoPendente && simuladoRespondido && (
        <SimuladoBanner
          title={simuladoRespondido.title}
          onClick={() =>
            (window.location.href = `/simulados/${simuladoRespondido.id}/resultado`)
          }
          ctaLabel="Ver meu resultado"
          tone="success"
          caderno_url={simuladoRespondido.caderno_url}
        />
      )}

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

      {/* PDFs do Aluno */}
      {pdfs && pdfs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
            <FileText className="h-3.5 w-3.5" />
            Suas listas e materiais
          </h2>
          {pdfs.map((pdf, idx) => (
            <PdfCard key={pdf.id} pdf={pdf} index={idx} />
          ))}
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

const PDF_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  cronograma: { label: "Cronograma semanal", emoji: "📅" },
  relatorio: { label: "Relatório de desempenho", emoji: "📊" },
  caderno_questoes: { label: "Caderno de questões", emoji: "📝" },
};

function PdfCard({ pdf, index }: { pdf: StudentPdf; index: number }) {
  const typeInfo = PDF_TYPE_LABELS[pdf.tipo] ?? { label: pdf.tipo.replace("_", " "), emoji: "📄" };
  const date = pdf.created_at
    ? new Date(pdf.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <a
      href={pdf.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border-2 bg-card p-3.5 transition-all active:scale-[0.98] hover:border-primary/30 animate-fade-in"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: "both" }}
    >
      <span className="text-2xl flex-shrink-0">{typeInfo.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-foreground leading-tight truncate">
          {typeInfo.label}
        </p>
        <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
          {date}
        </p>
      </div>
      <Download className="h-5 w-5 text-primary flex-shrink-0" />
    </a>
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

// ---------------------------------------------------------------------------
// SimuladoBanner — destaque no topo do feed quando ha simulado disponivel
// ---------------------------------------------------------------------------

interface SimuladoBannerProps {
  readonly title: string;
  readonly onClick: () => void;
  readonly ctaLabel: string;
  readonly tone: "accent" | "success";
  readonly caderno_url?: string | null;
}

function SimuladoBanner({ title, onClick, ctaLabel, tone, caderno_url }: SimuladoBannerProps) {
  const toneStyles =
    tone === "accent"
      ? {
          border: "border-accent",
          bg: "bg-accent/10",
          ctaBg: "bg-accent text-white hover:bg-accent/90",
          iconBg: "bg-accent/20 text-accent",
        }
      : {
          border: "border-emerald-500/40",
          bg: "bg-emerald-500/10",
          ctaBg: "bg-emerald-600 text-white hover:bg-emerald-700",
          iconBg: "bg-emerald-500/20 text-emerald-600",
        };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4 animate-bounce-in",
        toneStyles.border,
        toneStyles.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            toneStyles.iconBg,
          )}
        >
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Simulado ENEM
          </p>
          <p className="mt-0.5 text-sm font-black text-foreground leading-tight">
            {title}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black shadow-sm transition-all active:scale-[0.98]",
          toneStyles.ctaBg,
        )}
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      {caderno_url && (
        <a
          href={caderno_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-current/30 py-2 text-xs font-black text-foreground/70 hover:text-foreground transition-colors active:scale-[0.98]"
          aria-label="Baixar caderno de questões"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar Caderno
        </a>
      )}
    </div>
  );
}
