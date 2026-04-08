-- Migration: adiciona seed persistente de homologação para a taxonomia do mentor.
-- Objetivo: permitir homologação reversível sem sobrescrever mapping de produção.

-- ---------------------------------------------------------------------------
-- Metadados de origem e histórico
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_topics
  ADD COLUMN IF NOT EXISTS origin_source_context text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS origin_source_reference text NULL;

ALTER TABLE public.content_topics
  DROP CONSTRAINT IF EXISTS content_topics_origin_source_context_check;

ALTER TABLE public.content_topics
  ADD CONSTRAINT content_topics_origin_source_context_check CHECK (
    origin_source_context IN ('production', 'homologation')
  );

ALTER TABLE public.exam_question_topics
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_context text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS source_reference text NULL;

ALTER TABLE public.exam_question_topics
  DROP CONSTRAINT IF EXISTS exam_question_topics_source_context_check;

ALTER TABLE public.exam_question_topics
  ADD CONSTRAINT exam_question_topics_source_context_check CHECK (
    source_context IN ('production', 'homologation')
  );

ALTER TABLE public.mentor_plans
  ADD COLUMN IF NOT EXISTS taxonomy_source_kind text NOT NULL DEFAULT 'none';

ALTER TABLE public.mentor_plans
  DROP CONSTRAINT IF EXISTS mentor_plans_taxonomy_source_kind_check;

ALTER TABLE public.mentor_plans
  ADD CONSTRAINT mentor_plans_taxonomy_source_kind_check CHECK (
    taxonomy_source_kind IN ('none', 'homologation', 'mixed', 'production')
  );

DROP INDEX IF EXISTS public.idx_exam_question_topics_exam_question_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_question_topics_exam_question_active_unique
  ON public.exam_question_topics (exam_id, question_number)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_exam_question_topics_active_source
  ON public.exam_question_topics (source_context, review_status, created_at DESC)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- RPC transacional para apply do seed de homologação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_homologation_taxonomy_seed(
  seed_reference text,
  mappings jsonb
)
RETURNS TABLE(
  inserted_topics integer,
  reused_topics integer,
  inserted_mappings integer,
  updated_mappings integer,
  skipped_due_to_production integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parsed_count integer := 0;
  duplicate_pair_count integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.can_manage_mentor_content() THEN
    RAISE EXCEPTION 'Acesso negado para aplicar seed de homologação.'
      USING ERRCODE = '42501';
  END IF;

  IF seed_reference IS NULL OR btrim(seed_reference) = '' THEN
    RAISE EXCEPTION 'seed_reference é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  IF mappings IS NULL OR jsonb_typeof(mappings) <> 'array' THEN
    RAISE EXCEPTION 'mappings deve ser um array JSON.'
      USING ERRCODE = '22023';
  END IF;

  WITH parsed AS (
    SELECT
      btrim(item.exam_id) AS exam_id,
      item.question_number AS question_number,
      upper(btrim(item.area_sigla)) AS area_sigla,
      btrim(item.subject_label) AS subject_label,
      btrim(item.topic_label) AS topic_label,
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.exam_id IS NOT NULL
      AND btrim(item.exam_id) <> ''
      AND item.question_number IS NOT NULL
      AND item.question_number > 0
      AND item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
      AND item.subject_label IS NOT NULL
      AND btrim(item.subject_label) <> ''
      AND item.topic_label IS NOT NULL
      AND btrim(item.topic_label) <> ''
      AND item.area_sigla IS NOT NULL
      AND upper(btrim(item.area_sigla)) IN ('LC', 'CH', 'CN', 'MT', 'RED')
  )
  SELECT COUNT(*) INTO parsed_count
  FROM parsed;

  IF parsed_count = 0 THEN
    RETURN QUERY
    SELECT 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      btrim(item.exam_id) AS exam_id,
      item.question_number AS question_number
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.exam_id IS NOT NULL
      AND btrim(item.exam_id) <> ''
      AND item.question_number IS NOT NULL
      AND item.question_number > 0
  )
  SELECT COUNT(*) INTO duplicate_pair_count
  FROM (
    SELECT exam_id, question_number
    FROM parsed
    GROUP BY exam_id, question_number
    HAVING COUNT(*) > 1
  ) duplicated_pairs;

  IF duplicate_pair_count > 0 THEN
    RAISE EXCEPTION 'Seed de homologação contém pares duplicados de exam_id + question_number.'
      USING ERRCODE = '22023';
  END IF;

  WITH parsed_topics AS (
    SELECT DISTINCT
      upper(btrim(item.area_sigla)) AS area_sigla,
      btrim(item.subject_label) AS subject_label,
      btrim(item.topic_label) AS topic_label,
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
      AND item.subject_label IS NOT NULL
      AND btrim(item.subject_label) <> ''
      AND item.topic_label IS NOT NULL
      AND btrim(item.topic_label) <> ''
      AND item.area_sigla IS NOT NULL
      AND upper(btrim(item.area_sigla)) IN ('LC', 'CH', 'CN', 'MT', 'RED')
  ),
  inserted AS (
    INSERT INTO public.content_topics (
      area_sigla,
      subject_label,
      topic_label,
      canonical_label,
      is_active,
      origin_source_context,
      origin_source_reference
    )
    SELECT
      parsed_topics.area_sigla,
      parsed_topics.subject_label,
      parsed_topics.topic_label,
      parsed_topics.canonical_label,
      true,
      'homologation',
      seed_reference
    FROM parsed_topics
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.content_topics existing_topic
      WHERE lower(existing_topic.canonical_label) = lower(parsed_topics.canonical_label)
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_topics
  FROM inserted;

  WITH parsed_topics AS (
    SELECT DISTINCT
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
  )
  SELECT GREATEST(COUNT(*) - inserted_topics, 0) INTO reused_topics
  FROM parsed_topics;

  WITH parsed AS (
    SELECT
      btrim(item.exam_id) AS exam_id,
      item.question_number AS question_number,
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.exam_id IS NOT NULL
      AND btrim(item.exam_id) <> ''
      AND item.question_number IS NOT NULL
      AND item.question_number > 0
      AND item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
  ),
  resolved AS (
    SELECT DISTINCT
      parsed.exam_id,
      parsed.question_number,
      topic.id AS topic_id
    FROM parsed
    JOIN public.content_topics topic
      ON lower(topic.canonical_label) = lower(parsed.canonical_label)
  ),
  skipped AS (
    SELECT DISTINCT
      resolved.exam_id,
      resolved.question_number
    FROM resolved
    JOIN public.exam_question_topics mapping
      ON mapping.exam_id = resolved.exam_id
      AND mapping.question_number = resolved.question_number
      AND mapping.is_active = true
      AND mapping.source_context = 'production'
  )
  SELECT COUNT(*) INTO skipped_due_to_production
  FROM skipped;

  WITH parsed AS (
    SELECT
      btrim(item.exam_id) AS exam_id,
      item.question_number AS question_number,
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.exam_id IS NOT NULL
      AND btrim(item.exam_id) <> ''
      AND item.question_number IS NOT NULL
      AND item.question_number > 0
      AND item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
  ),
  resolved AS (
    SELECT DISTINCT
      parsed.exam_id,
      parsed.question_number,
      topic.id AS topic_id
    FROM parsed
    JOIN public.content_topics topic
      ON lower(topic.canonical_label) = lower(parsed.canonical_label)
  ),
  updatable AS (
    SELECT
      mapping.id,
      resolved.topic_id
    FROM resolved
    JOIN public.exam_question_topics mapping
      ON mapping.exam_id = resolved.exam_id
      AND mapping.question_number = resolved.question_number
      AND mapping.is_active = true
      AND mapping.source_context = 'homologation'
  )
  UPDATE public.exam_question_topics mapping
  SET
    topic_id = updatable.topic_id,
    mapping_source = 'legacy',
    review_status = 'approved',
    confidence = NULL,
    reviewed_by = NULL,
    reviewed_at = now(),
    source_reference = seed_reference,
    is_active = true
  FROM updatable
  WHERE mapping.id = updatable.id;

  GET DIAGNOSTICS updated_mappings = ROW_COUNT;

  WITH parsed AS (
    SELECT
      btrim(item.exam_id) AS exam_id,
      item.question_number AS question_number,
      btrim(item.canonical_label) AS canonical_label
    FROM jsonb_to_recordset(mappings) AS item(
      exam_id text,
      question_number integer,
      canonical_label text,
      subject_label text,
      topic_label text,
      area_sigla text
    )
    WHERE
      item.exam_id IS NOT NULL
      AND btrim(item.exam_id) <> ''
      AND item.question_number IS NOT NULL
      AND item.question_number > 0
      AND item.canonical_label IS NOT NULL
      AND btrim(item.canonical_label) <> ''
  ),
  resolved AS (
    SELECT DISTINCT
      parsed.exam_id,
      parsed.question_number,
      topic.id AS topic_id
    FROM parsed
    JOIN public.content_topics topic
      ON lower(topic.canonical_label) = lower(parsed.canonical_label)
  ),
  insertable AS (
    SELECT
      resolved.exam_id,
      resolved.question_number,
      resolved.topic_id
    FROM resolved
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.exam_question_topics mapping
      WHERE mapping.exam_id = resolved.exam_id
        AND mapping.question_number = resolved.question_number
        AND mapping.is_active = true
    )
  )
  INSERT INTO public.exam_question_topics (
    exam_id,
    question_number,
    topic_id,
    mapping_source,
    confidence,
    review_status,
    reviewed_by,
    reviewed_at,
    is_active,
    source_context,
    source_reference
  )
  SELECT
    insertable.exam_id,
    insertable.question_number,
    insertable.topic_id,
    'legacy',
    NULL,
    'approved',
    NULL,
    now(),
    true,
    'homologation',
    seed_reference
  FROM insertable;

  GET DIAGNOSTICS inserted_mappings = ROW_COUNT;

  RETURN QUERY
  SELECT
    COALESCE(inserted_topics, 0),
    COALESCE(reused_topics, 0),
    COALESCE(inserted_mappings, 0),
    COALESCE(updated_mappings, 0),
    COALESCE(skipped_due_to_production, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_homologation_taxonomy_seed(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_homologation_taxonomy_seed(text, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC transacional para cleanup do seed de homologação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_homologation_taxonomy_seed(
  seed_reference text
)
RETURNS TABLE(
  archived_mappings integer,
  archived_topics integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.can_manage_mentor_content() THEN
    RAISE EXCEPTION 'Acesso negado para limpar seed de homologação.'
      USING ERRCODE = '42501';
  END IF;

  IF seed_reference IS NULL OR btrim(seed_reference) = '' THEN
    RAISE EXCEPTION 'seed_reference é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.exam_question_topics
  SET is_active = false
  WHERE source_context = 'homologation'
    AND source_reference = seed_reference
    AND is_active = true;

  GET DIAGNOSTICS archived_mappings = ROW_COUNT;

  UPDATE public.content_topics topic
  SET is_active = false
  WHERE topic.is_active = true
    AND topic.origin_source_context = 'homologation'
    AND topic.origin_source_reference = seed_reference
    AND NOT EXISTS (
      SELECT 1
      FROM public.exam_question_topics mapping
      WHERE mapping.topic_id = topic.id
        AND mapping.is_active = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mentor_plan_items item
      WHERE item.topic_id = topic.id
    );

  GET DIAGNOSTICS archived_topics = ROW_COUNT;

  RETURN QUERY
  SELECT COALESCE(archived_mappings, 0), COALESCE(archived_topics, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_homologation_taxonomy_seed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_homologation_taxonomy_seed(text)
  TO authenticated, service_role;
