-- Migration: Mentor-Centric Performance Intelligence
-- Cria taxonomia canônica, plano do mentor, execuções de análise e feedback.

-- ---------------------------------------------------------------------------
-- Helpers de autorização
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_project_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.role
  FROM public.project_users pu
  WHERE pu.auth_uid = auth.uid()
    AND pu.is_active = true
  ORDER BY CASE WHEN pu.role = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.school_id
  FROM public.project_users pu
  WHERE pu.auth_uid = auth.uid()
    AND pu.is_active = true
  ORDER BY CASE WHEN pu.role = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_project_role() = 'super_admin', false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_mentor_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_project_role() IN ('super_admin', 'coordinator'), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_school(target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_super_admin() THEN true
    ELSE public.current_school_id() = target_school_id
  END;
$$;

REVOKE ALL ON FUNCTION public.current_project_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_school_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_mentor_content() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_school(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_project_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_mentor_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_school(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Taxonomia canônica de conteúdo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_sigla text NOT NULL CHECK (area_sigla IN ('LC', 'CH', 'CN', 'MT', 'RED')),
  subject_label text NOT NULL,
  topic_label text NOT NULL,
  canonical_label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_topics_canonical_label_unique
  ON public.content_topics (lower(canonical_label));

CREATE INDEX IF NOT EXISTS idx_content_topics_area_subject
  ON public.content_topics (area_sigla, subject_label);

CREATE TABLE IF NOT EXISTS public.exam_question_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id text NOT NULL,
  question_number integer NOT NULL CHECK (question_number > 0),
  topic_id uuid REFERENCES public.content_topics(id) ON DELETE SET NULL,
  mapping_source text NOT NULL CHECK (mapping_source IN ('manual', 'gliner_approved', 'legacy')),
  confidence numeric(5,4),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_question_topics_exam_question_unique
  ON public.exam_question_topics (exam_id, question_number);

CREATE INDEX IF NOT EXISTS idx_exam_question_topics_status
  ON public.exam_question_topics (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_question_topics_topic
  ON public.exam_question_topics (topic_id);

-- ---------------------------------------------------------------------------
-- Plano do mentor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  mentor_user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('student', 'turma')),
  student_key text NULL,
  turma text NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  source text NOT NULL CHECK (source IN ('auto_button', 'manual_edit')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'superseded', 'archived')),
  pdf_history_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_plans_target_guard CHECK (
    (target_type = 'student' AND student_key IS NOT NULL)
    OR (target_type = 'turma' AND turma IS NOT NULL)
  ),
  CONSTRAINT mentor_plans_week_guard CHECK (week_end >= week_start)
);

CREATE INDEX IF NOT EXISTS idx_mentor_plans_school_week
  ON public.mentor_plans (school_id, week_start DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_plans_student_week
  ON public.mentor_plans (student_key, week_start DESC)
  WHERE student_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mentor_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_plan_id uuid NOT NULL REFERENCES public.mentor_plans(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE RESTRICT,
  planned_order integer NOT NULL DEFAULT 0,
  expected_level text NOT NULL CHECK (expected_level IN ('recover', 'maintain', 'advance')),
  source text NOT NULL CHECK (source IN ('auto', 'manual')),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_plan_items_plan_topic_unique
  ON public.mentor_plan_items (mentor_plan_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_mentor_plan_items_plan_order
  ON public.mentor_plan_items (mentor_plan_id, planned_order);

-- ---------------------------------------------------------------------------
-- Execução da análise e alertas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_plan_id uuid NOT NULL REFERENCES public.mentor_plans(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_key text NOT NULL,
  overall_status text NOT NULL CHECK (overall_status IN ('verde', 'amarelo', 'vermelho', 'sem_dados')),
  briefing text NOT NULL,
  avg_mastery_planned numeric(6,2) NOT NULL DEFAULT 0,
  avg_mastery_critical numeric(6,2) NOT NULL DEFAULT 0,
  unmapped_questions_count integer NOT NULL DEFAULT 0,
  analyzed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_analysis_runs_plan
  ON public.mentor_analysis_runs (mentor_plan_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_analysis_runs_school_student
  ON public.mentor_analysis_runs (school_id, student_key, analyzed_at DESC);

CREATE TABLE IF NOT EXISTS public.mentor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id uuid NOT NULL REFERENCES public.mentor_analysis_runs(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_key text NOT NULL,
  topic_id uuid NULL REFERENCES public.content_topics(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('misaligned_plan', 'not_absorbed', 'persistent_gap', 'can_advance')),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_alerts_school_student
  ON public.mentor_alerts (school_id, student_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_alerts_status
  ON public.mentor_alerts (status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mentor_alert_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_alert_id uuid NOT NULL REFERENCES public.mentor_alerts(id) ON DELETE CASCADE,
  mentor_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('agree', 'disagree')),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_alert_feedback_unique
  ON public.mentor_alert_feedback (mentor_alert_id, mentor_user_id);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS mentor_plans_updated_at ON public.mentor_plans;
CREATE TRIGGER mentor_plans_updated_at
  BEFORE UPDATE ON public.mentor_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS mentor_alerts_updated_at ON public.mentor_alerts;
CREATE TRIGGER mentor_alerts_updated_at
  BEFORE UPDATE ON public.mentor_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_alert_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_topics_select" ON public.content_topics;
DROP POLICY IF EXISTS "content_topics_insert" ON public.content_topics;
DROP POLICY IF EXISTS "content_topics_update" ON public.content_topics;
DROP POLICY IF EXISTS "content_topics_delete" ON public.content_topics;

CREATE POLICY "content_topics_select"
ON public.content_topics
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "content_topics_insert"
ON public.content_topics
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "content_topics_update"
ON public.content_topics
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "content_topics_delete"
ON public.content_topics
FOR DELETE
TO authenticated
USING (public.can_manage_mentor_content());

DROP POLICY IF EXISTS "exam_question_topics_select" ON public.exam_question_topics;
DROP POLICY IF EXISTS "exam_question_topics_insert" ON public.exam_question_topics;
DROP POLICY IF EXISTS "exam_question_topics_update" ON public.exam_question_topics;
DROP POLICY IF EXISTS "exam_question_topics_delete" ON public.exam_question_topics;

CREATE POLICY "exam_question_topics_select"
ON public.exam_question_topics
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "exam_question_topics_insert"
ON public.exam_question_topics
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "exam_question_topics_update"
ON public.exam_question_topics
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "exam_question_topics_delete"
ON public.exam_question_topics
FOR DELETE
TO authenticated
USING (public.can_manage_mentor_content());

DROP POLICY IF EXISTS "mentor_plans_select" ON public.mentor_plans;
DROP POLICY IF EXISTS "mentor_plans_insert" ON public.mentor_plans;
DROP POLICY IF EXISTS "mentor_plans_update" ON public.mentor_plans;
DROP POLICY IF EXISTS "mentor_plans_delete" ON public.mentor_plans;

CREATE POLICY "mentor_plans_select"
ON public.mentor_plans
FOR SELECT
TO authenticated
USING (public.can_access_school(school_id));

CREATE POLICY "mentor_plans_insert"
ON public.mentor_plans
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_plans_update"
ON public.mentor_plans
FOR UPDATE
TO authenticated
USING (public.can_access_school(school_id))
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_plans_delete"
ON public.mentor_plans
FOR DELETE
TO authenticated
USING (public.can_access_school(school_id));

DROP POLICY IF EXISTS "mentor_plan_items_select" ON public.mentor_plan_items;
DROP POLICY IF EXISTS "mentor_plan_items_insert" ON public.mentor_plan_items;
DROP POLICY IF EXISTS "mentor_plan_items_update" ON public.mentor_plan_items;
DROP POLICY IF EXISTS "mentor_plan_items_delete" ON public.mentor_plan_items;

CREATE POLICY "mentor_plan_items_select"
ON public.mentor_plan_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND public.can_access_school(mp.school_id)
  )
);

CREATE POLICY "mentor_plan_items_insert"
ON public.mentor_plan_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND public.can_access_school(mp.school_id)
  )
);

CREATE POLICY "mentor_plan_items_update"
ON public.mentor_plan_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND public.can_access_school(mp.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND public.can_access_school(mp.school_id)
  )
);

CREATE POLICY "mentor_plan_items_delete"
ON public.mentor_plan_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND public.can_access_school(mp.school_id)
  )
);

DROP POLICY IF EXISTS "mentor_analysis_runs_select" ON public.mentor_analysis_runs;
DROP POLICY IF EXISTS "mentor_analysis_runs_insert" ON public.mentor_analysis_runs;
DROP POLICY IF EXISTS "mentor_analysis_runs_update" ON public.mentor_analysis_runs;
DROP POLICY IF EXISTS "mentor_analysis_runs_delete" ON public.mentor_analysis_runs;

CREATE POLICY "mentor_analysis_runs_select"
ON public.mentor_analysis_runs
FOR SELECT
TO authenticated
USING (public.can_access_school(school_id));

CREATE POLICY "mentor_analysis_runs_insert"
ON public.mentor_analysis_runs
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_analysis_runs_update"
ON public.mentor_analysis_runs
FOR UPDATE
TO authenticated
USING (public.can_access_school(school_id))
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_analysis_runs_delete"
ON public.mentor_analysis_runs
FOR DELETE
TO authenticated
USING (public.can_access_school(school_id));

DROP POLICY IF EXISTS "mentor_alerts_select" ON public.mentor_alerts;
DROP POLICY IF EXISTS "mentor_alerts_insert" ON public.mentor_alerts;
DROP POLICY IF EXISTS "mentor_alerts_update" ON public.mentor_alerts;
DROP POLICY IF EXISTS "mentor_alerts_delete" ON public.mentor_alerts;

CREATE POLICY "mentor_alerts_select"
ON public.mentor_alerts
FOR SELECT
TO authenticated
USING (public.can_access_school(school_id));

CREATE POLICY "mentor_alerts_insert"
ON public.mentor_alerts
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_alerts_update"
ON public.mentor_alerts
FOR UPDATE
TO authenticated
USING (public.can_access_school(school_id))
WITH CHECK (public.can_access_school(school_id));

CREATE POLICY "mentor_alerts_delete"
ON public.mentor_alerts
FOR DELETE
TO authenticated
USING (public.can_access_school(school_id));

DROP POLICY IF EXISTS "mentor_alert_feedback_select" ON public.mentor_alert_feedback;
DROP POLICY IF EXISTS "mentor_alert_feedback_insert" ON public.mentor_alert_feedback;
DROP POLICY IF EXISTS "mentor_alert_feedback_update" ON public.mentor_alert_feedback;
DROP POLICY IF EXISTS "mentor_alert_feedback_delete" ON public.mentor_alert_feedback;

CREATE POLICY "mentor_alert_feedback_select"
ON public.mentor_alert_feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_alerts ma
    WHERE ma.id = mentor_alert_feedback.mentor_alert_id
      AND public.can_access_school(ma.school_id)
  )
);

CREATE POLICY "mentor_alert_feedback_insert"
ON public.mentor_alert_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.mentor_alerts ma
    WHERE ma.id = mentor_alert_feedback.mentor_alert_id
      AND public.can_access_school(ma.school_id)
  )
);

CREATE POLICY "mentor_alert_feedback_update"
ON public.mentor_alert_feedback
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_alerts ma
    WHERE ma.id = mentor_alert_feedback.mentor_alert_id
      AND public.can_access_school(ma.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.mentor_alerts ma
    WHERE ma.id = mentor_alert_feedback.mentor_alert_id
      AND public.can_access_school(ma.school_id)
  )
);

CREATE POLICY "mentor_alert_feedback_delete"
ON public.mentor_alert_feedback
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mentor_alerts ma
    WHERE ma.id = mentor_alert_feedback.mentor_alert_id
      AND public.can_access_school(ma.school_id)
  )
);
