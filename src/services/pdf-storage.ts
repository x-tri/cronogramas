import { supabase } from "../lib/supabase";
import { logAudit } from "./audit";

const BUCKET = "cronogramas-pdf";

interface UploadPdfParams {
  blob: Blob;
  filename: string;
  schoolId: string;
  alunoId: string;
  alunoNome: string;
  turma?: string;
  matricula?: string;
  tipo?: "cronograma" | "plano_estudo";
}

/**
 * Upload PDF to Supabase Storage and register in pdf_history.
 * Path: {school_id}/{turma}/{filename}
 */
export async function uploadPdf({
  blob,
  filename,
  schoolId,
  alunoId,
  alunoNome,
  turma,
  matricula,
  tipo = "cronograma",
}: UploadPdfParams): Promise<{ url: string; path: string } | null> {
  const turmaFolder = turma ?? "sem-turma";
  const storagePath = `${schoolId}/${turmaFolder}/${filename}`;

  // Upload to storage (upsert to overwrite if same week)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[pdf-storage] Upload error:", uploadError.message);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // Register in history (ignore errors - storage is the priority)
  await supabase.from("pdf_history").insert({
    school_id: schoolId,
    aluno_id: alunoId,
    aluno_nome: alunoNome,
    turma,
    matricula,
    tipo,
    filename,
    storage_path: storagePath,
    file_size: blob.size,
  });

  logAudit("generate_pdf", "pdf", filename, { aluno: alunoNome, turma, schoolId });

  return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Delete a single PDF from storage and history
 */
export async function deletePdf(id: string, storagePath: string): Promise<boolean> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from("pdf_history").delete().eq("id", id);
  if (!error) {
    logAudit("delete_pdf", "pdf", id, { storagePath });
  }
  return !error;
}

/**
 * Delete all PDFs for a school (year cleanup)
 */
export async function deleteAllSchoolPdfs(schoolId: string): Promise<number> {
  // Get all paths
  const { data: records } = await supabase
    .from("pdf_history")
    .select("id, storage_path")
    .eq("school_id", schoolId);

  if (!records || records.length === 0) return 0;

  // Delete from storage in batches of 100
  const paths = records.map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }

  // Delete from history
  await supabase.from("pdf_history").delete().eq("school_id", schoolId);

  logAudit("delete_pdf", "pdf_batch", schoolId, { count: records.length });

  return records.length;
}
