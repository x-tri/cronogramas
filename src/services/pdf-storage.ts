import { supabase } from "../lib/supabase";
import { logAudit } from "./audit";
import { getCurrentProjectUser } from "../lib/project-user";

const BUCKET = "cronogramas-pdf";

// Signed URL TTL (1h). Suficiente para o fluxo "copiar link e enviar via WhatsApp"
// mantendo o link expirável (o bucket é privado — CRITICAL 1).
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Gera signed URL temporária para um PDF do bucket privado `cronogramas-pdf`.
 * Retorna null em caso de erro (ex.: path inexistente ou falha de RLS).
 *
 * `downloadAs`: nome de arquivo para forçar Content-Disposition attachment —
 * o navegador baixa em vez de abrir (usado no histórico por aluno).
 */
export async function getSignedPdfUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
  options?: { downloadAs?: string },
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      storagePath,
      ttlSeconds,
      options?.downloadAs ? { download: options.downloadAs } : undefined,
    );

  if (error || !data?.signedUrl) {
    console.error("[pdf-storage] Falha ao gerar signed URL:", {
      storagePath,
      error: error?.message,
    });
    return null;
  }

  return data.signedUrl;
}

interface UploadPdfParams {
  blob: Blob;
  filename: string;
  schoolId?: string | null;
  schoolName?: string | null;
  alunoId: string;
  alunoNome: string;
  turma?: string;
  matricula?: string;
  tipo?: "cronograma" | "relatorio" | "caderno_questoes";
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

function sanitizeStorageSegment(value: string, fallback: string): string {
  const sanitized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return sanitized || fallback;
}

export function buildPdfStoragePath(params: {
  readonly schoolId: string | null;
  readonly turma?: string | null;
  readonly filename: string;
}): string {
  const turmaFolder = sanitizeStorageSegment(params.turma ?? "sem-turma", "sem-turma");
  const storageFilename = sanitizeStorageSegment(params.filename, "arquivo.pdf");
  return `${params.schoolId ?? "sem-escola"}/${turmaFolder}/${storageFilename}`;
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
}: UploadPdfParams): Promise<{ url: string; path: string; historyId: string | null; schoolId: string | null } | null> {
  const resolvedSchoolId = await resolveSchoolId({
    schoolId,
    schoolName,
    matricula,
    alunoId,
  });
  const storagePath = buildPdfStoragePath({
    schoolId: resolvedSchoolId,
    turma,
    filename,
  });

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

  // Gera signed URL (bucket é privado — CRITICAL 1).
  // Se falhar, segue com upload registrado, retornando URL vazia em último caso.
  const signedUrl = await getSignedPdfUrl(storagePath);

  // Registra no historico. Sem isso o PDF existe no storage, mas nao aparece
  // no portal do aluno nem na auditoria do coordenador.
  //
  // Upsert lógico por storage_path: o upload acima sobrescreve o objeto
  // (upsert: true), então regenerar a mesma semana deve ATUALIZAR a linha
  // existente — duplicatas apontando para o mesmo objeto faziam o deletePdf
  // de uma delas apagar o arquivo compartilhado e orfanar as outras
  // (incidente FACEX 2026-06-11).
  const { data: existingRow } = await supabase
    .from("pdf_history")
    .select("id")
    .eq("storage_path", storagePath)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const historyValues = {
    school_id: resolvedSchoolId,
    aluno_id: alunoId,
    aluno_nome: alunoNome,
    turma,
    matricula,
    tipo,
    filename,
    storage_path: storagePath,
    file_size: blob.size,
  };

  const { data: historyRow, error: historyError } = existingRow?.id
    ? await supabase
        .from("pdf_history")
        .update({ ...historyValues, created_at: new Date().toISOString() })
        .eq("id", existingRow.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("pdf_history").insert(historyValues).select("id").maybeSingle();

  if (historyError) {
    console.error("[pdf-storage] Falha ao registrar pdf_history:", historyError.message, {
      filename,
      resolvedSchoolId,
      alunoId,
      matricula,
      tipo,
    });
    return null;
  }

  logAudit("generate_pdf", "pdf", filename, {
    aluno: alunoNome,
    turma,
    schoolId: resolvedSchoolId,
    tipo,
  });

  return {
    url: signedUrl ?? "",
    path: storagePath,
    historyId: (historyRow?.id as string | undefined) ?? existingRow?.id ?? null,
    schoolId: resolvedSchoolId,
  };
}

/**
 * Delete a single PDF from storage and history
 */
export async function deletePdf(id: string, storagePath: string): Promise<boolean> {
  // Linhas duplicadas legadas podem compartilhar o mesmo objeto no storage —
  // só remove o arquivo quando esta é a última linha apontando para o path.
  const { count } = await supabase
    .from("pdf_history")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", storagePath)
    .neq("id", id);

  if (!count) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

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
