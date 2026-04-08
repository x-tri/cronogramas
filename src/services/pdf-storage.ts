import { supabase } from "../lib/supabase";
import { logAudit } from "./audit";
import { getCurrentProjectUser } from "../lib/project-user";

const BUCKET = "cronogramas-pdf";

interface UploadPdfParams {
  blob: Blob;
  filename: string;
  schoolId?: string | null;
  schoolName?: string | null;
  alunoId: string;
  alunoNome: string;
  turma?: string;
  matricula?: string;
  tipo?: "cronograma" | "plano_estudo" | "relatorio" | "caderno_questoes";
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

async function resolveSchoolId(params: {
  schoolId?: string | null;
  schoolName?: string | null;
  matricula?: string;
  alunoId: string;
}): Promise<string | null> {
  if (isUuid(params.schoolId)) {
    return params.schoolId;
  }

  if (params.matricula) {
    const { data: studentByMatricula } = await supabase
      .from("students")
      .select("school_id")
      .eq("matricula", params.matricula)
      .maybeSingle();

    if (isUuid(studentByMatricula?.school_id)) {
      return studentByMatricula.school_id;
    }
  }

  const { data: studentById } = await supabase
    .from("students")
    .select("school_id")
    .eq("id", params.alunoId)
    .maybeSingle();

  if (isUuid(studentById?.school_id)) {
    return studentById.school_id;
  }

  if (params.schoolName?.trim()) {
    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("name", params.schoolName.trim())
      .maybeSingle();

    if (isUuid(school?.id)) {
      return school.id;
    }
  }

  const projectUser = await getCurrentProjectUser();
  if (isUuid(projectUser?.schoolId)) {
    return projectUser.schoolId;
  }

  return null;
}

/**
 * Upload PDF to Supabase Storage and register in pdf_history.
 * Path: {school_id}/{turma}/{filename}
 */
export async function uploadPdf({
  blob,
  filename,
  schoolId,
  schoolName,
  alunoId,
  alunoNome,
  turma,
  matricula,
  tipo = "cronograma",
}: UploadPdfParams): Promise<{ url: string; path: string } | null> {
  const resolvedSchoolId = await resolveSchoolId({
    schoolId,
    schoolName,
    matricula,
    alunoId,
  });
  const turmaFolder = turma ?? "sem-turma";
  const storagePath = `${resolvedSchoolId ?? "sem-escola"}/${turmaFolder}/${filename}`;

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
  const { error: historyError } = await supabase.from("pdf_history").insert({
    school_id: resolvedSchoolId,
    aluno_id: alunoId,
    aluno_nome: alunoNome,
    turma,
    matricula,
    tipo,
    filename,
    storage_path: storagePath,
    file_size: blob.size,
  });

  if (historyError) {
    console.warn("[pdf-storage] Falha ao registrar pdf_history:", historyError.message, {
      filename,
      resolvedSchoolId,
      alunoId,
      matricula,
      tipo,
    });
  }

  logAudit("generate_pdf", "pdf", filename, {
    aluno: alunoNome,
    turma,
    schoolId: resolvedSchoolId,
    tipo,
  });

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
