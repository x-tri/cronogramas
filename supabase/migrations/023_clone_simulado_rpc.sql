-- Migration 023: clone_simulado_to_school
--
-- Permite ao super_admin (ou coordinator da escola origem) duplicar um simulado
-- existente para outra escola, mantendo todos os 180 itens (gabarito, dificuldade,
-- topico, habilidade) e opcionalmente alterando titulo + turmas alvo.
--
-- Casos de uso:
--   - Aplicar mesmo simulado em multiplas escolas (Marista Natal -> Marista Aracagy)
--   - Reaproveitar gabarito de bimestre anterior
--
-- O simulado clonado SEMPRE comeca como 'draft' — coordenador revisa e publica.
-- Caderno_url NAO e copiado por padrao (cada escola pode ter seu link).

CREATE OR REPLACE FUNCTION public.clone_simulado_to_school(
  p_source_simulado_id uuid,
  p_target_school_id   uuid,
  p_new_title          text DEFAULT NULL,
  p_new_turmas         text[] DEFAULT NULL,
  p_copy_caderno_url   boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role           text;
  v_caller         uuid := auth.uid();
  v_source         RECORD;
  v_new_simulado_id uuid;
  v_item_count     int;
  v_final_title    text;
  v_final_turmas   text[];
  v_caderno        text;
BEGIN
  -- 1. Auth
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.current_project_role();

  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'coordinator') THEN
    RAISE EXCEPTION 'role % nao pode clonar simulados', coalesce(v_role, 'null')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Carrega cabecalho fonte
  SELECT id, title, school_id, turmas, caderno_url
    INTO v_source
  FROM public.simulados
  WHERE id = p_source_simulado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'simulado fonte % nao encontrado', p_source_simulado_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 3. Permissoes:
  --    - super_admin: pode clonar de qualquer escola pra qualquer escola
  --    - coordinator: so pode clonar de SUA escola pra SUA escola (uso raro)
  IF v_role = 'coordinator' THEN
    IF v_source.school_id IS DISTINCT FROM public.current_school_id() THEN
      RAISE EXCEPTION 'coordinator so pode clonar simulados da propria escola'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_target_school_id IS DISTINCT FROM public.current_school_id() THEN
      RAISE EXCEPTION 'coordinator so pode clonar para a propria escola'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 4. Valida escola destino
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_target_school_id) THEN
    RAISE EXCEPTION 'escola destino % nao existe', p_target_school_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 5. Resolve campos finais (com defaults razoaveis)
  v_final_title := nullif(btrim(coalesce(p_new_title, '')), '');
  IF v_final_title IS NULL THEN
    v_final_title := v_source.title || ' (cópia)';
  END IF;

  v_final_turmas := coalesce(p_new_turmas, '{}'::text[]);

  v_caderno := CASE WHEN p_copy_caderno_url THEN v_source.caderno_url ELSE NULL END;

  -- 6. Cria novo simulado (sempre draft)
  INSERT INTO public.simulados (
    title, school_id, turmas, caderno_url, status, created_by
  ) VALUES (
    v_final_title,
    p_target_school_id,
    v_final_turmas,
    v_caderno,
    'draft',
    v_caller
  )
  RETURNING id INTO v_new_simulado_id;

  -- 7. Copia os 180 itens
  INSERT INTO public.simulado_itens (
    simulado_id, numero, area, gabarito, dificuldade, topico, habilidade
  )
  SELECT
    v_new_simulado_id,
    si.numero,
    si.area,
    si.gabarito,
    si.dificuldade,
    si.topico,
    si.habilidade
  FROM public.simulado_itens si
  WHERE si.simulado_id = p_source_simulado_id
  ORDER BY si.numero;

  -- 8. Sanity check: simulado fonte tem que ter 180 itens; se nao tiver,
  --    abortar a transacao (rollback automatico via RAISE).
  GET DIAGNOSTICS v_item_count = ROW_COUNT;
  IF v_item_count <> 180 THEN
    RAISE EXCEPTION 'simulado fonte tem % itens, esperado 180 — clone abortado', v_item_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_new_simulado_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_simulado_to_school(uuid, uuid, text, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_simulado_to_school(uuid, uuid, text, text[], boolean) TO authenticated;

COMMENT ON FUNCTION public.clone_simulado_to_school(uuid, uuid, text, text[], boolean) IS
  'Duplica simulado fonte (cabecalho + 180 itens) para outra escola. super_admin = qualquer escola; coordinator = mesma escola apenas. Resultado: novo simulado em draft.';
