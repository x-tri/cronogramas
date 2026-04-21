/**
 * Hook do aluno para histórico TRI (Fase 4).
 *
 * Chama a Edge Function `get-student-performance` que federa dados de
 * simulado_respostas (cronogramas) + projetos (legacy axtmozyrns).
 *
 * Resposta contém:
 *  - performances[]: lista ordenada desc por data
 *  - fontes_utilizadas: fontes que retornaram dados
 *  - legacy_status / cronogramas_status: 'ok' | 'fallback' | 'disabled'
 *
 * Auth: o hook usa a sessão do aluno logado; o backend valida que
 * o JWT.sub corresponde ao students.profile_id.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { StudentPerformanceResponse } from "@/types/performance";

export function useStudentPerformance(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-performance", studentId],
    queryFn: async (): Promise<StudentPerformanceResponse | null> => {
      if (!studentId) return null;
      const { data, error } = await supabase.functions.invoke(
        "get-student-performance",
        { body: { student_id: studentId } },
      );
      if (error) {
        throw new Error(error.message ?? "Falha ao carregar histórico TRI");
      }
      return (data ?? null) as StudentPerformanceResponse | null;
    },
    enabled: !!studentId,
    // Legacy é imutável, cronogramas muda só em submit → 10min está ok
    staleTime: 10 * 60 * 1000,
  });
}
