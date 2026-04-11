import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GamificationData {
  readonly xp_total: number;
  readonly streak_weeks: number;
  readonly level: number;
  readonly title: string;
  readonly blocos_done: number;
  readonly blocos_total: number;
  readonly semanas_total: number;
  readonly xp_next_level: number;
}

const EMPTY_GAMIFICATION: GamificationData = {
  xp_total: 0,
  streak_weeks: 0,
  level: 1,
  title: "Calouro",
  blocos_done: 0,
  blocos_total: 0,
  semanas_total: 0,
  xp_next_level: 100,
};

export function useGamification(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["gamification", studentKey],
    queryFn: async (): Promise<GamificationData> => {
      const { data, error } = await supabase.rpc("get_student_gamification", {
        p_student_key: studentKey!,
      });

      if (error) {
        console.warn("[gamification] Erro ao buscar:", error.message);
        return EMPTY_GAMIFICATION;
      }

      return (data as GamificationData) ?? EMPTY_GAMIFICATION;
    },
    enabled: !!studentKey,
    staleTime: 2 * 60 * 1000,
  });
}
