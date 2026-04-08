-- Migration: cria o core semântico do GLiNER no Supabase/Postgres.
-- Objetivo: sustentar enriquecimento de questões, auditoria e rastreabilidade
-- sem introduzir uma nova infraestrutura de banco.

-- ---------------------------------------------------------------------------
-- Arestas entre tópicos canônicos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topic_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  target_topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK (edge_type IN ('prerequisite', 'related', 'depends_on', 'part_of')),
  weight numeric NOT NULL DEFAULT 1,
  confidence_score numeric NULL,
  source_context text NOT NULL DEFAULT 'production'
    CHECK (source_context IN ('production', 'homologation')),
  source_run_id uuid NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_topic_id <> target_topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_edges_source
  ON public.topic_edges (source_topic_id, edge_type, is_active);

CREATE INDEX IF NOT EXISTS idx_topic_edges_target
  ON public.topic_edges (target_topic_id, edge_type, is_active);

CREATE INDEX IF NOT EXISTS idx_topic_edges_pair
  ON public.topic_edges (source_topic_id, target_topic_id, edge_type);

-- ---------------------------------------------------------------------------
-- Runs de enriquecimento do GLiNER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL CHECK (source_system IN ('exams', 'projetos', 'manual')),
  source_reference text NULL,
  model_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  items_processed integer NOT NULL DEFAULT 0,
  items_written integer NOT NULL DEFAULT 0,
  items_flagged integer NOT NULL DEFAULT 0,
  error_summary text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_runs_created_at
  ON public.question_enrichment_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_runs_status
  ON public.question_enrichment_runs (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Enriquecimentos gerados sobre as questões
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id text NOT NULL,
  question_number integer NOT NULL CHECK (question_number > 0),
  topic_id uuid NULL REFERENCES public.content_topics(id) ON DELETE SET NULL,
  enrichment_type text NOT NULL CHECK (enrichment_type IN ('topic', 'entity', 'skill_hint', 'difficulty_hint')),
  canonical_label text NULL,
  confidence_score numeric NULL,
  source_model text NOT NULL,
  source_context text NOT NULL DEFAULT 'production'
    CHECK (source_context IN ('production', 'homologation')),
  source_run_id uuid NULL REFERENCES public.question_enrichment_runs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'flagged', 'overridden', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_enrichments_exam_question
  ON public.question_enrichments (exam_id, question_number, status);

CREATE INDEX IF NOT EXISTS idx_question_enrichments_topic
  ON public.question_enrichments (topic_id, status);

CREATE INDEX IF NOT EXISTS idx_question_enrichments_run
  ON public.question_enrichments (source_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_enrichments_context
  ON public.question_enrichments (source_context, enrichment_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Evidências textuais do enriquecimento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_enrichment_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_enrichment_id uuid NOT NULL REFERENCES public.question_enrichments(id) ON DELETE CASCADE,
  source_text text NOT NULL,
  source_excerpt text NULL,
  source_position jsonb NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_sources_enrichment
  ON public.question_enrichment_sources (question_enrichment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Auditoria operacional do enriquecimento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_enrichment_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_enrichment_id uuid NULL REFERENCES public.question_enrichments(id) ON DELETE SET NULL,
  run_id uuid NULL REFERENCES public.question_enrichment_runs(id) ON DELETE SET NULL,
  audit_type text NOT NULL CHECK (
    audit_type IN (
      'low_confidence',
      'text_image_mismatch',
      'duplicate_conflict',
      'missing_visual_context',
      'topic_too_generic'
    )
  ),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_audits_status
  ON public.question_enrichment_audits (status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_audits_run
  ON public.question_enrichment_audits (run_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Overrides manuais para exceções
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_enrichment_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_enrichment_id uuid NOT NULL REFERENCES public.question_enrichments(id) ON DELETE CASCADE,
  override_topic_id uuid NULL REFERENCES public.content_topics(id) ON DELETE SET NULL,
  override_label text NULL,
  reason text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_enrichment_overrides_enrichment
  ON public.question_enrichment_overrides (question_enrichment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.topic_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_enrichment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_enrichment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_enrichment_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_enrichment_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_edges_select" ON public.topic_edges;
DROP POLICY IF EXISTS "topic_edges_insert" ON public.topic_edges;
DROP POLICY IF EXISTS "topic_edges_update" ON public.topic_edges;

DROP POLICY IF EXISTS "question_enrichment_runs_select" ON public.question_enrichment_runs;
DROP POLICY IF EXISTS "question_enrichment_runs_insert" ON public.question_enrichment_runs;
DROP POLICY IF EXISTS "question_enrichment_runs_update" ON public.question_enrichment_runs;

DROP POLICY IF EXISTS "question_enrichments_select" ON public.question_enrichments;
DROP POLICY IF EXISTS "question_enrichments_insert" ON public.question_enrichments;
DROP POLICY IF EXISTS "question_enrichments_update" ON public.question_enrichments;

DROP POLICY IF EXISTS "question_enrichment_sources_select" ON public.question_enrichment_sources;
DROP POLICY IF EXISTS "question_enrichment_sources_insert" ON public.question_enrichment_sources;
DROP POLICY IF EXISTS "question_enrichment_sources_update" ON public.question_enrichment_sources;

DROP POLICY IF EXISTS "question_enrichment_audits_select" ON public.question_enrichment_audits;
DROP POLICY IF EXISTS "question_enrichment_audits_insert" ON public.question_enrichment_audits;
DROP POLICY IF EXISTS "question_enrichment_audits_update" ON public.question_enrichment_audits;

DROP POLICY IF EXISTS "question_enrichment_overrides_select" ON public.question_enrichment_overrides;
DROP POLICY IF EXISTS "question_enrichment_overrides_insert" ON public.question_enrichment_overrides;

CREATE POLICY "topic_edges_select"
ON public.topic_edges
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "topic_edges_insert"
ON public.topic_edges
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "topic_edges_update"
ON public.topic_edges
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_runs_select"
ON public.question_enrichment_runs
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_runs_insert"
ON public.question_enrichment_runs
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_runs_update"
ON public.question_enrichment_runs
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichments_select"
ON public.question_enrichments
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "question_enrichments_insert"
ON public.question_enrichments
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichments_update"
ON public.question_enrichments
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_sources_select"
ON public.question_enrichment_sources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.question_enrichments qe
    WHERE qe.id = question_enrichment_sources.question_enrichment_id
      AND public.can_manage_mentor_content()
  )
);

CREATE POLICY "question_enrichment_sources_insert"
ON public.question_enrichment_sources
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.question_enrichments qe
    WHERE qe.id = question_enrichment_sources.question_enrichment_id
      AND public.can_manage_mentor_content()
  )
);

CREATE POLICY "question_enrichment_sources_update"
ON public.question_enrichment_sources
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.question_enrichments qe
    WHERE qe.id = question_enrichment_sources.question_enrichment_id
      AND public.can_manage_mentor_content()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.question_enrichments qe
    WHERE qe.id = question_enrichment_sources.question_enrichment_id
      AND public.can_manage_mentor_content()
  )
);

CREATE POLICY "question_enrichment_audits_select"
ON public.question_enrichment_audits
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_audits_insert"
ON public.question_enrichment_audits
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_audits_update"
ON public.question_enrichment_audits
FOR UPDATE
TO authenticated
USING (public.can_manage_mentor_content())
WITH CHECK (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_overrides_select"
ON public.question_enrichment_overrides
FOR SELECT
TO authenticated
USING (public.can_manage_mentor_content());

CREATE POLICY "question_enrichment_overrides_insert"
ON public.question_enrichment_overrides
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_mentor_content());
