import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SetSisuGoalArgs {
  readonly sigla: string;
  readonly uf: string;
  readonly curso: string;
}

/**
 * Salva a meta SISU do aluno via RPC `set_my_sisu_goal` (SECURITY DEFINER).
 * Invalida o cache da meta (["sisu-goal", studentId]) em sucesso — mesma
 * queryKey usada por useSisuGoal.
 */
export function useSetSisuGoal(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sigla, uf, curso }: SetSisuGoalArgs) => {
      // typegen não inclui esta RPC nova → cast na boundary (padrão do projeto)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("set_my_sisu_goal", {
        p_sigla: sigla,
        p_uf: uf,
        p_curso: curso,
      });
      if (error) throw new Error(error.message ?? "Falha ao salvar a meta.");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sisu-goal", studentId] });
    },
  });
}
