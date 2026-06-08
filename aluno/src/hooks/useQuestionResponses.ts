import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QuestionResponse {
  answered: string;
  correct: boolean;
}

export type QuestionResponseMap = Map<number, QuestionResponse>;

/**
 * Respostas que o aluno já deu às questões recomendadas (1ª tentativa, pois o
 * upsert usa ignoreDuplicates). Keyed por co_item. Usado para mostrar progresso
 * por habilidade e marcar questões já respondidas (sem reconceder XP).
 */
export function useQuestionResponses(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["question-responses", studentKey],
    queryFn: async (): Promise<QuestionResponseMap> => {
      const { data, error } = await supabase
        .from("student_question_responses")
        .select("co_item, answered, correct")
        .eq("student_key", studentKey!);

      if (error) {
        console.warn("[question-responses] Falha ao carregar:", error.message);
        return new Map();
      }

      const map: QuestionResponseMap = new Map();
      for (const r of data ?? []) {
        map.set(r.co_item as number, {
          answered: r.answered as string,
          correct: r.correct as boolean,
        });
      }
      return map;
    },
    enabled: !!studentKey,
    staleTime: 60 * 1000,
  });
}
