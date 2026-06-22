import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensurePdfFilename } from "@/lib/pdf-download";

const BUCKET = "cronogramas-pdf";
// 1 hora de validade — suficiente pra ver/baixar; URL nova em cada page load
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface StudentPdf {
  readonly id: string;
  readonly tipo: string;
  readonly filename: string;
  readonly storage_path: string;
  readonly url: string | null;
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

      const rows = dedupePdfRows((data ?? []) as PdfHistoryRow[]);

      // Gera signed URLs em paralelo — bucket é privado, não dá pra usar /public/
      const pdfs = await Promise.all(
        rows.map(async (row): Promise<StudentPdf | null> => {
          const { data: signed, error: sErr } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
              download: ensurePdfFilename(row.filename),
            });

          if (sErr || !signed?.signedUrl) {
            console.warn("[student-pdfs] Falha ao assinar PDF:", row.id, sErr?.message);
            return {
              id: row.id,
              tipo: row.tipo,
              filename: row.filename,
              storage_path: row.storage_path,
              url: null,
              file_size: row.file_size,
              created_at: row.created_at,
            };
          }

          return {
            id: row.id,
            tipo: row.tipo,
            filename: row.filename,
            storage_path: row.storage_path,
            url: signed.signedUrl,
            file_size: row.file_size,
            created_at: row.created_at,
          };
        }),
      );

      return pdfs;
    },
    enabled: !!studentKey,
    staleTime: 5 * 60 * 1000,
  });
}

function dedupePdfRows(rows: ReadonlyArray<PdfHistoryRow>): PdfHistoryRow[] {
  const byFile = new Map<string, PdfHistoryRow>();
  for (const row of rows) {
    const key = row.storage_path || `${row.tipo}:${row.filename}`;
    if (!byFile.has(key)) {
      byFile.set(key, row);
    }
  }
  return [...byFile.values()];
}
