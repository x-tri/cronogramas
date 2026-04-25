/**
 * useTrackPdfDownload — registra a primeira vez que o aluno clica para
 * baixar um PDF (cronograma/relatorio/caderno_questoes).
 *
 * Padrao: fire-and-forget. O INSERT roda em paralelo com a abertura do
 * link, sem bloquear a UI. ON CONFLICT DO NOTHING (via upsert com
 * ignoreDuplicates) garante que rederrubas nao sobrescrevem a primeira
 * data registrada.
 *
 * Para visualizacao do coordenador, ver migration 025 e a view
 * pdf_history_with_status.
 */

import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

interface TrackPdfDownloadParams {
  readonly pdfHistoryId: string;
  readonly studentId: string;
  readonly matricula: string | null;
  readonly schoolId: string;
}

async function insertDownloadLog(params: TrackPdfDownloadParams): Promise<void> {
  const { error } = await supabase
    .from("pdf_download_log")
    .upsert(
      {
        pdf_history_id: params.pdfHistoryId,
        student_id: params.studentId,
        matricula: params.matricula,
        school_id: params.schoolId,
      },
      {
        // Preserva a primeira data — UNIQUE (pdf_history_id, student_id)
        // garante 1 linha por par; rederrubas viram no-op silencioso.
        onConflict: "pdf_history_id,student_id",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    // Nao quebra o fluxo do download; apenas avisa em dev.
    console.warn("[track-pdf-download] Falha ao registrar:", error.message);
  }
}

export function useTrackPdfDownload() {
  return useMutation({
    mutationFn: insertDownloadLog,
  });
}
