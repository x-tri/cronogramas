import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SisuGoal {
  readonly sisu_curso_nome: string | null;
  readonly sisu_universidade: string | null;
  readonly sisu_uf: string | null;
  readonly sisu_nota_corte: number | null;
}

/**
 * Busca a meta SISU do aluno logado (students.sisu_*).
 * Retorna null se nenhum dos campos estiver preenchido.
 */
export function useSisuGoal(studentId: string | undefined) {
  return useQuery({
    queryKey: ["sisu-goal", studentId],
    queryFn: async (): Promise<SisuGoal | null> => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("students")
        .select(
          "sisu_curso_nome, sisu_universidade, sisu_uf, sisu_nota_corte",
        )
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || !data.sisu_curso_nome) return null;
      return data as SisuGoal;
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000,
  });
}
