// Tipos e helpers compartilhados entre a auditoria de PDFs (admin-pdfs.tsx)
// e o drawer de histórico por aluno (pdf-student-history-drawer.tsx).

export interface PdfSchool {
  id: string
  name: string
}

export interface PdfRecord {
  id: string
  school_id: string
  aluno_id: string
  aluno_nome: string
  turma: string | null
  matricula: string | null
  tipo: string
  filename: string
  storage_path: string
  file_size: number | null
  created_at: string
  school?: PdfSchool | null
  // Vindos de pdf_history_with_status (migration 025)
  download_count: number
  first_downloaded_at: string | null
  last_downloaded_at: string | null
}

export const PDF_TYPE_LABELS: Readonly<Record<string, string>> = {
  cronograma: 'Cronograma semanal',
  relatorio: 'Relatório de desempenho',
  caderno_questoes: 'Caderno de questões',
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
