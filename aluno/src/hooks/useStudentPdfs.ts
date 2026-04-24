import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "cronogramas-pdf";
// 1 hora de validade — suficiente pra ver/baixar; URL nova em cada page load
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface StudentPdf {
  readonly id: string;
  readonly tipo: string;
  readonly filename: string;
  readonly url: string;
  readonly file_size: number | null;
  readonly created_at: string | null;
}

interface PdfHistoryRow {
  readonly id: string;
  readonly tipo: string;
  readonly filename: string;
  readonly storage_path: string;
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

      const rows = (data ?? []) as PdfHistoryRow[];

      // Gera signed URLs em paralelo — bucket é privado, não dá pra usar /public/
      const pdfs = await Promise.all(
        rows.map(async (row): Promise<StudentPdf> => {
          const { data: signed, error: sErr } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

          if (sErr || !signed?.signedUrl) {
            console.warn("[student-pdfs] Falha ao assinar:", row.storage_path, sErr?.message);
          }

          return {
            id: row.id,
            tipo: row.tipo,
            filename: row.filename,
            url: signed?.signedUrl ?? "",
            file_size: row.file_size,
            created_at: row.created_at,
          };
        }),
      );

      // Filtra os que falharam ao assinar
      return pdfs.filter((p) => p.url !== "");
    },
    enabled: !!studentKey,
    staleTime: 5 * 60 * 1000,
  });
}
