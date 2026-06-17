import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SisuUniversidade { sigla: string; uf: string; nome: string }
export interface SisuCursoCorte { curso: string; nota_corte: number }

export function useSisuUniversidades() {
  return useQuery({
    queryKey: ["sisu-universidades"],
    queryFn: async (): Promise<SisuUniversidade[]> => {
      // typegen não inclui esta RPC nova → cast na boundary (padrão do projeto)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_sisu_universidades");
      if (error) throw new Error(error.message);
      return (data ?? []) as SisuUniversidade[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useSisuCursos(sigla: string | undefined, uf: string | undefined) {
  return useQuery({
    queryKey: ["sisu-cursos", sigla, uf],
    queryFn: async (): Promise<SisuCursoCorte[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sisu_cortes")
        .select("curso, nota_corte, ano")
        .eq("sigla", sigla)
        .eq("uf", uf)
        .order("ano", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ curso: string; nota_corte: number; ano: number }>;
      const byCurso = new Map<string, { nota_corte: number; ano: number }>();
      for (const r of rows) {
        const cur = byCurso.get(r.curso);
        if (!cur || Number(r.ano) > cur.ano) {
          byCurso.set(r.curso, { nota_corte: Number(r.nota_corte), ano: Number(r.ano) });
        }
      }
      return [...byCurso.entries()]
        .map(([curso, v]) => ({ curso, nota_corte: v.nota_corte }))
        .sort((a, b) => b.nota_corte - a.nota_corte || a.curso.localeCompare(b.curso));
    },
    enabled: Boolean(sigla && uf),
    staleTime: 60 * 60 * 1000,
  });
}
