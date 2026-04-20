-- Migration: RPC create_simulado_with_items (Fase 3.2)
--
-- Motivacao:
--   O admin/coordenador cria simulados via wizard no frontend. Precisamos
--   garantir que cabecalho (simulados) + 180 itens (simulado_itens) sejam
--   persistidos atomicamente e com validacao de escopo de escola.
--
-- Contrato:
--   Input:
--     p_title      - nome do simulado (nao-vazio)
--     p_school_id  - escola alvo; para coordinator, deve bater com
--                    current_school_id()
--     p_turmas     - turmas alvo (array vazio = todas as turmas da escola)
--     p_items      - jsonb array de { numero, gabarito, dificuldade, topico }
--                    com 180 elementos (45 por area). Area e DERIVADA do
--                    numero no servidor (nao vem do cliente).
--   Output:
--     uuid do simulado criado (status='draft', created_by=auth.uid()).
--
-- Comportamento:
--   - SECURITY DEFINER: bypassa RLS, mas valida escopo antes.
--   - Exception se role != super_admin e school_id != current_school_id().
--   - Exception se p_items nao tem exatamente 180 itens.
--   - Exception se numero/gabarito/dificuldade fora de faixa (capturado
--     pelos CHECK constraints de simulado_itens).
--   - PL/pgSQL garante atomicidade (function e transacional por default).

-- ---------------------------------------------------------------------------
-- Helper: deriva area a partir do numero da questao (faixas ENEM fixas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.area_from_numero(p_numero int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_numero BETWEEN 1   AND 45  THEN 'LC'
    WHEN p_numero BETWEEN 46  AND 90  THEN 'CH'
    WHEN p_numero BETWEEN 91  AND 135 THEN 'CN'
    WHEN p_numero BETWEEN 136 AND 180 THEN 'MT'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.area_from_numero(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.area_from_numero(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_simulado_with_items
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_simulado_with_items(text, uuid, text[], jsonb);

CREATE OR REPLACE FUNCTION public.create_simulado_with_items(
  p_title     text,
  p_school_id uuid,
  p_turmas    text[],
  p_items     jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_simulado_id uuid;
  v_item_count int;
  v_caller     uuid := auth.uid();
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

  -- 3. Cria cabecalho como draft
  INSERT INTO public.simulados (title, school_id, turmas, created_by)
  VALUES (btrim(p_title), p_school_id, coalesce(p_turmas, '{}'::text[]), v_caller)
  RETURNING id INTO v_simulado_id;

  -- 4. Insere itens derivando a area a partir do numero.
  --    CHECK constraints de simulado_itens (definidos em 015) cobrem
  --    numero 1..180, gabarito A-E, dificuldade 1..5 e consistencia
  --    numero<->area. Se qualquer item for invalido, o INSERT levanta
  --    check_violation e a transacao inteira roda back.
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

REVOKE ALL ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_simulado_with_items(text, uuid, text[], jsonb) IS
  'Cria simulado (draft) + 180 itens atomicamente. Valida escopo de escola via project_users.role.';
