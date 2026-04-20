import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/cronogramas-pdf`;

export interface StudentPdf {
  readonly id: string;
  readonly tipo: string;
  readonly filename: string;
  readonly url: string;
  readonly file_size: number | null;
  readonly created_at: string | null;
}

export function useStudentPdfs(studentKey: string | undefined) {
  return useQuery({
    queryKey: ["student-pdfs", studentKey],
    queryFn: async (): Promise<StudentPdf[]> => {
      const { data, error } = await supabase
        .from("pdf_history")
        .select("id, tipo, filename, storage_path, file_size, created_at")
        .eq("matricula", studentKey!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("[student-pdfs] Erro ao buscar:", error.message);
        return [];
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        tipo: row.tipo,
        filename: row.filename,
        url: `${BUCKET_URL}/${row.storage_path}`,
        file_size: row.file_size,
        created_at: row.created_at,
      }));
    },
    enabled: !!studentKey,
    staleTime: 5 * 60 * 1000,
  });
}
