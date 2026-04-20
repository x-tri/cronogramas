/**
 * Hooks do aluno para simulados (Fase 4).
 *
 * - useSimuladosPendentes: lista simulados published da escola/turma do aluno
 *   com flag ja_respondeu.
 * - useSimuladoResultado: payload completo de um simulado submetido
 *   (ou metadados se ainda nao submetido).
 * - useSubmitSimulado: mutation que chama a Edge Function autoritativa.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  SimuladoPendenteRow,
  SimuladoResultado,
  SubmitSimuladoResponse,
} from "@/types/simulado";

/**
 * Lista simulados pendentes/publicos para o aluno logado.
 * RLS + SECURITY DEFINER RPC escopam automaticamente a escola/turma.
 */
export function useSimuladosPendentes() {
  return useQuery({
    queryKey: ["simulados-pendentes"],
    queryFn: async (): Promise<ReadonlyArray<SimuladoPendenteRow>> => {
      const { data, error } = await supabase.rpc(
        "get_student_simulados_pendentes",
      );
      if (error) throw new Error(error.message);
      return (data ?? []) as SimuladoPendenteRow[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Carrega o resultado (ou metadados pre-submit) de um simulado.
 * Se o aluno nao submeteu, `resposta` e `itens` sao null.
 */
export function useSimuladoResultado(simuladoId: string | undefined) {
  return useQuery({
    queryKey: ["simulado-resultado", simuladoId],
    queryFn: async (): Promise<SimuladoResultado | null> => {
      if (!simuladoId) return null;
      const { data, error } = await supabase.rpc(
        "get_student_simulado_resultado",
        { p_simulado_id: simuladoId },
      );
      if (error) throw new Error(error.message);
      return (data ?? null) as SimuladoResultado | null;
    },
    enabled: !!simuladoId,
    staleTime: 30 * 1000,
  });
}

interface SubmitArgs {
  readonly simuladoId: string;
  /** Map { "1": "A", ..., "180": "E" }. Letras fora de A-E sao tratadas como branco no servidor. */
  readonly answers: Record<string, string>;
}

/**
 * Envia respostas via Edge Function autoritativa (calcula TRI no servidor).
 * Invalida listagem + resultado em sucesso.
 */
export function useSubmitSimulado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      simuladoId,
      answers,
    }: SubmitArgs): Promise<SubmitSimuladoResponse> => {
      const { data, error } = await supabase.functions.invoke(
        "submit-simulado",
        {
          body: { simulado_id: simuladoId, answers },
        },
      );
      if (error) {
        // Supabase FunctionsError inclui o body em `context` em alguns SDKs;
        // propagamos a mensagem mais util disponivel.
        throw new Error(error.message ?? "Falha ao enviar simulado.");
      }
      if (!data || typeof data !== "object") {
        throw new Error("Resposta invalida do servidor.");
      }
      return data as SubmitSimuladoResponse;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["simulados-pendentes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["simulado-resultado", variables.simuladoId],
      });
    },
  });
}
