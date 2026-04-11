import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentNotification {
  readonly type: string;
  readonly priority: number;
  readonly emoji: string;
  readonly title: string;
  readonly message: string;
  readonly action_label?: string;
  readonly action_route?: string;
  readonly color: "primary" | "accent" | "success";
  readonly progress?: number;
}

export function useNotifications(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["notifications", studentKey],
    queryFn: async (): Promise<ReadonlyArray<StudentNotification>> => {
      const { data, error } = await supabase.rpc("get_student_notifications", {
        p_student_key: studentKey!,
      });

      if (error) {
        console.warn("[notifications] Erro ao buscar:", error.message);
        return [];
      }

      return (data as ReadonlyArray<StudentNotification>) ?? [];
    },
    enabled: !!studentKey,
    staleTime: 2 * 60 * 1000,
  });
}
