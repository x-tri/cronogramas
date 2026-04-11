import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useStudentProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCronogramas(studentId: string | undefined, matricula: string | undefined | null) {
  return useQuery({
    queryKey: ["cronogramas", studentId, matricula],
    queryFn: async () => {
      // cronogramas.aluno_id may contain UUID or matricula depending on how they were created
      const keys = [studentId, matricula].filter(Boolean) as string[];
      const { data, error } = await supabase
        .from("cronogramas")
        .select("*")
        .in("aluno_id", keys)
        .order("semana_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

export function useBlocos(cronogramaId: string | undefined) {
  return useQuery({
    queryKey: ["blocos", cronogramaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocos_cronograma")
        .select("*")
        .eq("cronograma_id", cronogramaId!)
        .order("horario_inicio");
      if (error) throw error;
      return data;
    },
    enabled: !!cronogramaId,
  });
}

export function useAnalysisRuns(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["analysis-runs", studentKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_analysis_runs")
        .select("*")
        .eq("student_key", studentKey!)
        .order("analyzed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentKey,
  });
}

export function useAlerts(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["alerts", studentKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_alerts")
        .select("*")
        .eq("student_key", studentKey!)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentKey,
  });
}

export function usePlanItems(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["plan-items", studentKey],
    queryFn: async () => {
      const { data: plans, error: plansError } = await supabase
        .from("mentor_plans")
        .select("id")
        .eq("student_key", studentKey!)
        .in("status", ["active", "sent"]);
      if (plansError) throw plansError;
      if (!plans?.length) return [];

      const planIds = plans.map((p) => p.id);
      const { data, error } = await supabase
        .from("mentor_plan_items")
        .select("*, content_topics:topic_id(area_sigla, subject_label, topic_label, canonical_label)")
        .in("mentor_plan_id", planIds)
        .order("planned_order");
      if (error) throw error;
      return data;
    },
    enabled: !!studentKey,
  });
}

export function useStudentReports(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["student-reports", studentKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_reports")
        .select("*")
        .eq("student_key", studentKey!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentKey,
  });
}

export function useAllBlocos(studentId: string | undefined, matricula: string | undefined | null) {
  return useQuery({
    queryKey: ["all-blocos", studentId, matricula],
    queryFn: async () => {
      const keys = [studentId, matricula].filter(Boolean) as string[];
      // First get all cronogramas
      const { data: crons, error: cronError } = await supabase
        .from("cronogramas")
        .select("id, semana_inicio, semana_fim")
        .in("aluno_id", keys)
        .order("semana_inicio", { ascending: true });
      if (cronError) throw cronError;
      if (!crons?.length) return { cronogramas: [], blocos: [] };

      const cronIds = crons.map((c) => c.id);
      const { data: blocos, error } = await supabase
        .from("blocos_cronograma")
        .select("*, cronograma_id")
        .in("cronograma_id", cronIds)
        .order("horario_inicio");
      if (error) throw error;
      return { cronogramas: crons, blocos: blocos || [] };
    },
    enabled: !!studentId,
  });
}
