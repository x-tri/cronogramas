import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SisuCorteRow } from "@/services/sisu-data";

/**
 * Busca os cortes SISU (ampla concorrencia) da tabela sisu_cortes para a
 * universidade da meta do aluno. Tabela importada do projeto sisu2025
 * (anos 2025/2026); o typegen ainda nao a inclui, dai o cast na boundary.
 */
export function useSisuCortes(
  sigla: string | null | undefined,
  uf: string | null | undefined,
) {
  const siglaNorm = sigla?.trim().toUpperCase() ?? "";
  const ufNorm = uf?.trim().toUpperCase() ?? "";
  return useQuery({
    queryKey: ["sisu-cortes", siglaNorm, ufNorm],
    queryFn: async (): Promise<readonly SisuCorteRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sisu_cortes")
        .select("sigla, nome, uf, curso, nota_corte, ano")
        .eq("sigla", siglaNorm)
        .eq("uf", ufNorm);
      if (error) throw new Error("Falha ao carregar cortes SISU");
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows
        .filter(
          (r) =>
            typeof r.sigla === "string" &&
            typeof r.curso === "string" &&
            r.nota_corte != null,
        )
        .map((r) => ({
          sigla: r.sigla as string,
          nome: typeof r.nome === "string" ? r.nome : (r.sigla as string),
          uf: typeof r.uf === "string" ? r.uf : ufNorm,
          curso: r.curso as string,
          nota_corte: Number(r.nota_corte),
          ano: Number(r.ano),
        }));
    },
    enabled: siglaNorm.length > 0 && ufNorm.length > 0,
    staleTime: 60 * 60 * 1000,
  });
}
