import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SisuGoal {
  readonly sisu_curso_nome: string | null;
  readonly sisu_universidade: string | null;
  readonly sisu_uf: string | null;
  readonly sisu_nota_corte: number | null;
}

/**
 * Busca a meta SISU do aluno logado (students.sisu_* — migration 019).
 *
 * Nota: o Supabase generated types (aluno/src/integrations/supabase/types.ts)
 * nao foi regenerado apos migration 019 — os campos sisu_* existem no DB
 * mas nao no typegen. Por isso fazemos a consulta com tipagem desligada
 * e cast controlado na boundary (defensive: checa string no curso_nome).
 */
export function useSisuGoal(studentId: string | undefined) {
  return useQuery({
    queryKey: ["sisu-goal", studentId],
    queryFn: async (): Promise<SisuGoal | null> => {
      if (!studentId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("students")
        .select(
          "sisu_curso_nome, sisu_universidade, sisu_uf, sisu_nota_corte",
        )
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw new Error((error as { message?: string }).message ?? "Falha ao carregar meta SISU");
      if (!data) return null;
      const typed = data as {
        sisu_curso_nome?: unknown;
        sisu_universidade?: unknown;
        sisu_uf?: unknown;
        sisu_nota_corte?: unknown;
      };
      if (typeof typed.sisu_curso_nome !== "string" || typed.sisu_curso_nome.length === 0) {
        return null;
      }
      return {
        sisu_curso_nome: typed.sisu_curso_nome,
        sisu_universidade:
          typeof typed.sisu_universidade === "string" ? typed.sisu_universidade : null,
        sisu_uf: typeof typed.sisu_uf === "string" ? typed.sisu_uf : null,
        sisu_nota_corte:
          typeof typed.sisu_nota_corte === "number"
            ? typed.sisu_nota_corte
            : typeof typed.sisu_nota_corte === "string"
              ? Number(typed.sisu_nota_corte)
              : null,
      };
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000,
  });
}
