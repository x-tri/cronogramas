export type AuditAction =
  | "login"
  | "logout"
  | "create_cronograma"
  | "delete_cronograma"
  | "update_cronograma"
  | "create_block"
  | "update_block"
  | "delete_block"
  | "generate_pdf"
  | "delete_pdf"
  | "add_coordinator"
  | "remove_coordinator"
  | "create_schedule"
  | "update_schedule"
  | "delete_schedule"
  | "generate_ai_plan"
  | "create_mentor_plan"
  | "update_mentor_plan"
  | "send_mentor_plan"
  | "run_gap_analysis"
  | "review_topic_mapping"
  | "feedback_alert"
  | "create_content_topic"
  | "run_question_enrichment"
  | "override_question_enrichment";

export interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  school_id: string | null;
  action: AuditAction;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
}

export interface ApiUsageEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  school_id: string | null;
  endpoint: string;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  status: number | null;
  duration_ms: number | null;
  error: string | null;
}

export interface DashboardStats {
  total_schools: number;
  total_coordinators: number;
  total_students: number;
  total_cronogramas: number;
  total_pdfs: number;
  storage_bytes: number;
  cronogramas_today: number;
  cronogramas_week: number;
  api_calls_today: number;
  api_errors_today: number;
}

export type AdminPage =
  | "overview"
  | "coordinators"
  | "schedules"
  | "control"
  | "performance"
  | "content_mapping"
  | "pdfs"
  | "audit"
  | "api";
