-- Migration 022: caderno_url em simulados
--
-- Adiciona campo opcional caderno_url na tabela simulados para que o
-- coordenador cole o link do PDF do caderno de questões (Google Drive ou
-- qualquer URL pública). O link é exibido nos cards de simulado do aluno.
--
-- Mudanças:
--   1. ALTER TABLE simulados ADD COLUMN caderno_url text (nullable)
--   2. Recria create_simulado_with_items com p_caderno_url opcional
--   3. Recria get_student_simulados_pendentes retornando caderno_url

-- ---------------------------------------------------------------------------
-- 1. Coluna
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulados
  ADD COLUMN IF NOT EXISTS caderno_url text;

COMMENT ON COLUMN public.simulados.caderno_url IS
  'Link público para download do caderno de questões (PDF). Opcional.';

-- ---------------------------------------------------------------------------
-- 2. Recria create_simulado_with_items com p_caderno_url
--    (mantém retrocompatibilidade: default NULL preserva chamadas sem o param)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_simulado_with_items(text, uuid, text[], jsonb);

CREATE OR REPLACE FUNCTION public.create_simulado_with_items(
  p_title       text,
  p_school_id   uuid,
  p_turmas      text[],
  p_items       jsonb,
  p_caderno_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_simulado_id uuid;
  v_item_count  int;
  v_caller      uuid := auth.uid();
BEGIN
  -- 1. Auth / escopo
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.current_project_role();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'role nao encontrado em project_users para %', v_caller
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_role NOT IN ('super_admin', 'coordinator') THEN
    RAISE EXCEPTION 'role % nao pode criar simulados', v_role
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_role = 'coordinator' AND public.current_school_id() IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'coordinator so pode criar simulado da propria escola'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validacao basica do payload
  IF coalesce(length(btrim(p_title)), 0) = 0 THEN
    RAISE EXCEPTION 'title obrigatorio'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items deve ser jsonb array'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT jsonb_array_length(p_items) INTO v_item_count;
  IF v_item_count <> 180 THEN
    RAISE EXCEPTION 'items deve ter exatamente 180 elementos, recebido %', v_item_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Cria cabecalho como draft (inclui caderno_url)
  INSERT INTO public.simulados (title, school_id, turmas, caderno_url, created_by)
  VALUES (
    btrim(p_title),
    p_school_id,
    coalesce(p_turmas, '{}'::text[]),
    nullif(btrim(coalesce(p_caderno_url, '')), ''),
    v_caller
  )
  RETURNING id INTO v_simulado_id;

  -- 4. Insere itens derivando area a partir do numero.
  INSERT INTO public.simulado_itens (
    simulado_id, numero, area, gabarito, dificuldade, topico, habilidade
  )
  SELECT
    v_simulado_id,
    (item ->> 'numero')::int                                  AS numero,
    public.area_from_numero((item ->> 'numero')::int)         AS area,
    upper(btrim(item ->> 'gabarito'))                         AS gabarito,
    (item ->> 'dificuldade')::int                             AS dificuldade,
    nullif(btrim(coalesce(item ->> 'topico', '')), '')        AS topico,
    nullif(btrim(coalesce(item ->> 'habilidade', '')), '')    AS habilidade
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_simulado_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb, text) IS
  'Cria simulado (draft) + 180 itens atomicamente. Aceita caderno_url opcional. Valida escopo via project_users.role.';

-- ---------------------------------------------------------------------------
-- 3. Recria get_student_simulados_pendentes incluindo caderno_url
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_student_simulados_pendentes();

CREATE OR REPLACE FUNCTION public.get_student_simulados_pendentes()
RETURNS TABLE (
  id           uuid,
  title        text,
  school_id    uuid,
  turmas       text[],
  published_at timestamptz,
  ja_respondeu boolean,
  submitted_at timestamptz,
  caderno_url  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT s.id AS student_id, s.school_id, s.turma
    FROM public.students s
    WHERE s.profile_id = auth.uid()
    ORDER BY s.id
    LIMIT 1
  )
  SELECT
    sim.id,
    sim.title,
    sim.school_id,
    sim.turmas,
    sim.published_at,
    (resp.id IS NOT NULL) AS ja_respondeu,
    resp.submitted_at,
    sim.caderno_url
  FROM public.simulados sim
  CROSS JOIN me
  LEFT JOIN public.simulado_respostas resp
         ON resp.simulado_id = sim.id
        AND resp.student_id  = me.student_id
  WHERE sim.status     = 'published'
    AND sim.school_id  = me.school_id
    AND (
      cardinality(sim.turmas) = 0
      OR me.turma = ANY(sim.turmas)
    )
  ORDER BY sim.published_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_student_simulados_pendentes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_simulados_pendentes() TO authenticated;

COMMENT ON FUNCTION public.get_student_simulados_pendentes() IS
  'Lista simulados published da escola do aluno com flag de ja_respondeu e caderno_url.';
