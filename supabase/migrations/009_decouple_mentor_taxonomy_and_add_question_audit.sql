-- Migration: desacopla Mentor Core da taxonomia e adiciona auditoria do banco de questões.

-- ---------------------------------------------------------------------------
-- Desacoplamento do plano do mentor
-- ---------------------------------------------------------------------------
ALTER TABLE public.mentor_plans
  ADD COLUMN IF NOT EXISTS capability_state text NOT NULL DEFAULT 'ready'
    CHECK (capability_state IN ('core_missing', 'taxonomy_missing', 'taxonomy_partial', 'ready')),
  ADD COLUMN IF NOT EXISTS generation_mode text NOT NULL DEFAULT 'taxonomy_complete'
    CHECK (generation_mode IN ('preview_only', 'fallback_guided', 'hybrid', 'taxonomy_complete')),
  ADD COLUMN IF NOT EXISTS mapped_pairs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pairs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distinct_topics integer NOT NULL DEFAULT 0;

ALTER TABLE public.mentor_plan_items
  ALTER COLUMN topic_id DROP NOT NULL;

ALTER TABLE public.mentor_plan_items
  ADD COLUMN IF NOT EXISTS fallback_label text NULL,
  ADD COLUMN IF NOT EXISTS fallback_area_sigla text NULL,
  ADD COLUMN IF NOT EXISTS fallback_habilidade integer NULL;

ALTER TABLE public.mentor_plan_items
  DROP CONSTRAINT IF EXISTS mentor_plan_items_topic_or_fallback_guard;

ALTER TABLE public.mentor_plan_items
  ADD CONSTRAINT mentor_plan_items_topic_or_fallback_guard CHECK (
    topic_id IS NOT NULL OR fallback_label IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Auditoria persistida do banco de questões
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_bank_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NULL,
  source_project_ref text NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  findings_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_bank_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid NOT NULL REFERENCES public.question_bank_audit_runs(id) ON DELETE CASCADE,
  source_year integer NOT NULL,
  source_question integer NOT NULL,
  source_exam text NULL,
  question_id text NULL,
  defect_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_audit_runs_created_at
  ON public.question_bank_audit_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_bank_audit_findings_run
  ON public.question_bank_audit_findings (audit_run_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_bank_audit_findings_item
  ON public.question_bank_audit_findings (source_year, source_question, detected_at DESC);

ALTER TABLE public.question_bank_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_audit_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_bank_audit_runs_select" ON public.question_bank_audit_runs;
DROP POLICY IF EXISTS "question_bank_audit_runs_insert" ON public.question_bank_audit_runs;
DROP POLICY IF EXISTS "question_bank_audit_findings_select" ON public.question_bank_audit_findings;
DROP POLICY IF EXISTS "question_bank_audit_findings_insert" ON public.question_bank_audit_findings;

CREATE POLICY "question_bank_audit_runs_select"
ON public.question_bank_audit_runs
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "question_bank_audit_runs_insert"
ON public.question_bank_audit_runs
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_bank_audit_findings_select"
ON public.question_bank_audit_findings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.question_bank_audit_runs qbar
    WHERE qbar.id = question_bank_audit_findings.audit_run_id
      AND public.can_manage_mentor_content()
  )
);

CREATE POLICY "question_bank_audit_findings_insert"
ON public.question_bank_audit_findings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.question_bank_audit_runs qbar
    WHERE qbar.id = question_bank_audit_findings.audit_run_id
      AND public.can_manage_mentor_content()
  )
);
