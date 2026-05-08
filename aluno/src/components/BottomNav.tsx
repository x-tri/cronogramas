import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Bell, Calendar, FileSearch, ClipboardList } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useSimuladosPendentes } from "@/hooks/useSimulados";
import { useBlocos, useCronogramas, useStudentProfile } from "@/hooks/useStudentData";
import { supabase } from "@/integrations/supabase/client";

const JS_DAY_TO_KEY = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;

const tabs = [
  { to: "/", icon: Calendar, label: "Plano", indicator: "plano" },
  { to: "/simulados", icon: ClipboardList, label: "Simulados", indicator: "simulados" },
  { to: "/desempenho", icon: BarChart3, label: "Evolução" },
  { to: "/analise", icon: FileSearch, label: "Análise" },
  { to: "/avisos", icon: Bell, label: "Avisos", indicator: "avisos" },
] as const;

type IndicatorKey = "plano" | "simulados" | "avisos";
type Fingerprints = Record<IndicatorKey, string>;
type SeenMap = Partial<Record<IndicatorKey, string>>;

export default function BottomNav() {
  const indicators = useNavIndicators();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label, indicator }) => {
          const hasIndicator = indicator ? indicators[indicator] : false;
          return (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={hasIndicator ? `${label}: novidade` : label}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-bold transition-all rounded-xl",
                isActive
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                  isActive ? "bg-primary/15" : ""
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "animate-pop")} />
                  {hasIndicator && (
                    <span
                      className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-red-500"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span className="max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function useNavIndicators(): Record<IndicatorKey, boolean> {
  const location = useLocation();
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const queryClient = useQueryClient();
  const { data: notifications } = useNotifications(studentKey);
  const { data: simulados } = useSimuladosPendentes();
  const { data: cronogramas } = useCronogramas(student?.id, student?.matricula);
  const activeCron = cronogramas?.[0];
  const { data: blocos } = useBlocos(activeCron?.id);
  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  const hasTodayPendingBlocks = Boolean(
    blocos?.some((bloco) => bloco.dia_semana === todayKey && !bloco.concluido),
  );
  const [optimisticSeen, setOptimisticSeen] = useState<SeenMap>({});

  const fingerprints = useMemo<Fingerprints>(() => {
    const plano = hasTodayPendingBlocks && activeCron
      ? [
          activeCron.id,
          activeCron.semana_inicio,
          todayKey,
          blocos?.filter((bloco) => bloco.dia_semana === todayKey).length ?? 0,
        ].join(":")
      : "";

    const simuladosFingerprint =
      simulados
        ?.filter((simulado) => !simulado.ja_respondeu)
        .map((simulado) => `${simulado.id}:${simulado.published_at ?? ""}`)
        .sort()
        .join("|") ?? "";

    const avisosFingerprint =
      notifications
        ?.map((notification) =>
          [
            notification.type,
            notification.priority,
            notification.title,
            notification.action_route ?? "",
          ].join(":"),
        )
        .sort()
        .join("|") ?? "";

    return {
      plano,
      simulados: simuladosFingerprint,
      avisos: avisosFingerprint,
    };
  }, [activeCron, blocos, hasTodayPendingBlocks, notifications, simulados, todayKey]);

  const seenQuery = useQuery({
    queryKey: ["student-nav-seen", student?.profile_id],
    queryFn: async (): Promise<SeenMap> => {
      const { data, error } = await supabase
        .from("student_nav_seen")
        .select("section, fingerprint");

      if (error) return {};

      return (data ?? []).reduce<SeenMap>((acc, row) => {
        if (isIndicatorKey(row.section)) {
          acc[row.section] = row.fingerprint;
        }
        return acc;
      }, {});
    },
    enabled: Boolean(student?.profile_id),
    staleTime: 2 * 60 * 1000,
  });

  const markSeen = useMutation({
    mutationFn: async ({ section, fingerprint }: { section: IndicatorKey; fingerprint: string }) => {
      const { error } = await supabase
        .from("student_nav_seen")
        .upsert(
          {
            section,
            fingerprint,
            seen_at: new Date().toISOString(),
          },
          { onConflict: "profile_id,section" },
        );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student-nav-seen", student?.profile_id] });
    },
  });

  const seen = useMemo<SeenMap>(
    () => ({ ...(seenQuery.data ?? {}), ...optimisticSeen }),
    [optimisticSeen, seenQuery.data],
  );

  useEffect(() => {
    if (!student?.profile_id) {
      setOptimisticSeen({});
    }
  }, [student?.profile_id]);

  useEffect(() => {
    if (!student?.profile_id) return;

    const current = getSectionFromPath(location.pathname);
    if (!current || !fingerprints[current]) return;
    if (seen[current] === fingerprints[current]) return;

    setOptimisticSeen((prev) => {
      const next = { ...prev, [current]: fingerprints[current] };
      return next;
    });
    markSeen.mutate({ section: current, fingerprint: fingerprints[current] });
  }, [fingerprints, location.pathname, markSeen, seen, student?.profile_id]);

  return {
    plano: Boolean(fingerprints.plano && seen.plano !== fingerprints.plano),
    simulados: Boolean(fingerprints.simulados && seen.simulados !== fingerprints.simulados),
    avisos: Boolean(fingerprints.avisos && seen.avisos !== fingerprints.avisos),
  };
}

function getSectionFromPath(pathname: string): IndicatorKey | null {
  if (pathname === "/") return "plano";
  if (pathname.startsWith("/simulados")) return "simulados";
  if (pathname.startsWith("/avisos")) return "avisos";
  return null;
}

function isIndicatorKey(value: string): value is IndicatorKey {
  return value === "plano" || value === "simulados" || value === "avisos";
}
