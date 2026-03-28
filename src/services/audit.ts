import { supabase } from "../lib/supabase";
import type { AuditAction } from "../types/admin";

/**
 * Fire-and-forget audit log. Never blocks UI.
 */
export function logAudit(
  action: AuditAction,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get school_id from project_users
      const { data: pu } = await supabase
        .from("project_users")
        .select("school_id, name")
        .eq("auth_uid", user.id)
        .eq("is_active", true)
        .maybeSingle();

      await supabase.from("audit_log").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: pu?.name ?? user.user_metadata?.name ?? user.email ?? null,
        school_id: pu?.school_id ?? null,
        action,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        metadata: metadata ?? {},
      });
    } catch (err) {
      console.warn("[audit] Failed to log:", action, err);
    }
  })();
}

/**
 * Fire-and-forget API usage log.
 */
export function logApiUsage(params: {
  endpoint: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  status?: number;
  duration_ms?: number;
  error?: string | null;
}): void {
  void (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let schoolId: string | null = null;
      if (user) {
        const { data: pu } = await supabase
          .from("project_users")
          .select("school_id")
          .eq("auth_uid", user.id)
          .eq("is_active", true)
          .maybeSingle();
        schoolId = pu?.school_id ?? null;
      }

      await supabase.from("api_usage").insert({
        user_id: user?.id ?? null,
        school_id: schoolId,
        endpoint: params.endpoint,
        model: params.model ?? null,
        tokens_in: params.tokens_in ?? 0,
        tokens_out: params.tokens_out ?? 0,
        status: params.status ?? null,
        duration_ms: params.duration_ms ?? null,
        error: params.error ?? null,
      });
    } catch (err) {
      console.warn("[audit] Failed to log API usage:", err);
    }
  })();
}
