-- Migration: RPCs de simulados para o aluno (Fase 2)
--
-- RPCs expostas ao frontend do aluno via supabase.rpc():
--   * get_student_simulados_pendentes() — lista simulados published da escola
--     do aluno com flag de "ja respondeu".
--   * get_student_simulado_resultado(p_simulado_id) — payload completo da
--     resposta (scores TRI, totais, mapa de erros, itens com feedback).
--
-- Ambas SECURITY DEFINER: validam escopo internamente via student_school_id()
-- e student_turma() (definidos em 016). Se o aluno nao tem direito, retornam
-- vazio/null — sem vazamento.

-- ---------------------------------------------------------------------------
-- get_student_simulados_pendentes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_student_simulados_pendentes();

CREATE OR REPLACE FUNCTION public.get_student_simulados_pendentes()
RETURNS TABLE (
  id uuid,
  title text,
  school_id uuid,
  turmas text[],
  published_at timestamptz,
  ja_respondeu boolean,
  submitted_at timestamptz
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
    resp.submitted_at
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
  'Lista simulados published da escola/turma do aluno logado com flag "ja respondeu".';

-- ---------------------------------------------------------------------------
-- get_student_simulado_resultado
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_student_simulado_resultado(uuid);

CREATE OR REPLACE FUNCTION public.get_student_simulado_resultado(
  p_simulado_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
  v_turma      text;
  v_resposta   public.simulado_respostas%ROWTYPE;
  v_simulado   public.simulados%ROWTYPE;
  v_itens      jsonb;
  v_sim_json   jsonb;
BEGIN
  -- Identifica o aluno logado.
  SELECT s.id, s.school_id, s.turma INTO v_student_id, v_school_id, v_turma
  FROM public.students s
  WHERE s.profile_id = auth.uid()
  ORDER BY s.id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Carrega simulado e valida escopo de escola + turma (defense in depth:
  -- mesmo se o student trocar de turma apos submeter, ele so ve o resultado
  -- se continuar elegivel — evita leak indireto de simulados restritos).
  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = p_simulado_id
    AND school_id = v_school_id
    AND (
      cardinality(turmas) = 0
      OR v_turma = ANY(turmas)
    );

  IF v_simulado.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Projeta apenas campos seguros do simulado para o frontend.
  v_sim_json := jsonb_build_object(
    'id',           v_simulado.id,
    'title',        v_simulado.title,
    'school_id',    v_simulado.school_id,
    'turmas',       v_simulado.turmas,
    'status',       v_simulado.status,
    'published_at', v_simulado.published_at,
    'closed_at',    v_simulado.closed_at
  );

  -- Carrega resposta (se existir).
  SELECT * INTO v_resposta
  FROM public.simulado_respostas
  WHERE simulado_id = p_simulado_id
    AND student_id  = v_student_id;

  IF v_resposta.id IS NULL THEN
    -- Aluno ainda nao respondeu — retorna metadados do simulado sem gabarito.
    RETURN jsonb_build_object(
      'simulado',   v_sim_json,
      'resposta',   NULL,
      'itens',      NULL,
      'submitted',  false
    );
  END IF;

  -- Monta itens com feedback por questao (resposta do aluno vs gabarito + topico).
  SELECT jsonb_agg(
    jsonb_build_object(
      'numero',         it.numero,
      'area',           it.area,
      'gabarito',       it.gabarito,
      'dificuldade',    it.dificuldade,
      'topico',         it.topico,
      'habilidade',     it.habilidade,
      'resposta_aluno', v_resposta.answers ->> it.numero::text,
      'correto', (
        (v_resposta.answers ->> it.numero::text) IS NOT NULL
        AND upper(trim(v_resposta.answers ->> it.numero::text)) = it.gabarito
      ),
      'branco', (
        COALESCE(trim(v_resposta.answers ->> it.numero::text), '') = ''
      )
    )
    ORDER BY it.numero
  ) INTO v_itens
  FROM public.simulado_itens it
  WHERE it.simulado_id = p_simulado_id;

  RETURN jsonb_build_object(
    'simulado',  v_sim_json,
    'resposta',  to_jsonb(v_resposta),
    'itens',     COALESCE(v_itens, '[]'::jsonb),
    'submitted', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_simulado_resultado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_simulado_resultado(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_student_simulado_resultado(uuid) IS
  'Retorna resultado completo (TRI, totais, erros, itens com feedback) de um simulado para o aluno logado.';
