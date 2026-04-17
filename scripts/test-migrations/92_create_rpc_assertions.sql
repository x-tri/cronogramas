-- Assertions sobre create_simulado_with_items (migration 018).
-- Roda DEPOIS de 91_rpc_assertions.sql (que deixa o DB com simulados limpos).

\set ON_ERROR_STOP on

BEGIN;

-- Garante schools/students/project_users dos testes anteriores (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    INSERT INTO public.schools (id, name) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Escola A'),
      ('22222222-2222-2222-2222-222222222222', 'Escola B');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_users WHERE email = 'super@xtri.com') THEN
    INSERT INTO public.project_users (auth_uid, email, name, school_id, role, is_active) VALUES
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'super@xtri.com', 'Super', NULL, 'super_admin', true),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'coordA@xtri.com', 'Coord A',
       '11111111-1111-1111-1111-111111111111', 'coordinator', true);
  END IF;
END $$;

-- Helper: monta payload de 180 itens validos como jsonb array.
CREATE OR REPLACE FUNCTION pg_temp.make_180_items() RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_agg(
    jsonb_build_object(
      'numero', n,
      'gabarito', 'A',
      'dificuldade', 3,
      'topico', 'Topico ' || CASE
        WHEN n BETWEEN 1 AND 45  THEN 'LC'
        WHEN n BETWEEN 46 AND 90 THEN 'CH'
        WHEN n BETWEEN 91 AND 135 THEN 'CN'
        ELSE 'MT'
      END
    )
    ORDER BY n
  )
  FROM generate_series(1, 180) n;
$$;

\echo ''
\echo '[CREATE-TEST 1] area_from_numero mapeia corretamente'
DO $$
BEGIN
  IF public.area_from_numero(1)   <> 'LC' THEN RAISE EXCEPTION 'FALHOU: numero=1 deveria ser LC'; END IF;
  IF public.area_from_numero(45)  <> 'LC' THEN RAISE EXCEPTION 'FALHOU: numero=45 deveria ser LC'; END IF;
  IF public.area_from_numero(46)  <> 'CH' THEN RAISE EXCEPTION 'FALHOU: numero=46 deveria ser CH'; END IF;
  IF public.area_from_numero(90)  <> 'CH' THEN RAISE EXCEPTION 'FALHOU: numero=90 deveria ser CH'; END IF;
  IF public.area_from_numero(91)  <> 'CN' THEN RAISE EXCEPTION 'FALHOU: numero=91 deveria ser CN'; END IF;
  IF public.area_from_numero(135) <> 'CN' THEN RAISE EXCEPTION 'FALHOU: numero=135 deveria ser CN'; END IF;
  IF public.area_from_numero(136) <> 'MT' THEN RAISE EXCEPTION 'FALHOU: numero=136 deveria ser MT'; END IF;
  IF public.area_from_numero(180) <> 'MT' THEN RAISE EXCEPTION 'FALHOU: numero=180 deveria ser MT'; END IF;
  IF public.area_from_numero(0)   IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: numero=0 deveria ser NULL'; END IF;
  IF public.area_from_numero(181) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: numero=181 deveria ser NULL'; END IF;
  RAISE NOTICE 'OK: area_from_numero mapeia todas as 4 areas + retorna NULL fora da faixa.';
END $$;

\echo ''
\echo '[CREATE-TEST 2] super_admin cria simulado com 180 itens -> sucesso + area derivada'
DO $$
DECLARE v_sid uuid; v_count int; v_lc int; v_mt int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  SELECT public.create_simulado_with_items(
    'Simulado de teste',
    '11111111-1111-1111-1111-111111111111',
    ARRAY[]::text[],
    pg_temp.make_180_items()
  ) INTO v_sid;

  IF v_sid IS NULL THEN RAISE EXCEPTION 'FALHOU: retornou NULL'; END IF;

  -- Simulado existe como draft
  IF NOT EXISTS (SELECT 1 FROM public.simulados WHERE id = v_sid AND status = 'draft') THEN
    RAISE EXCEPTION 'FALHOU: simulado nao encontrado ou status != draft';
  END IF;

  -- Itens: 180 no total, 45 por area
  SELECT COUNT(*) INTO v_count FROM public.simulado_itens WHERE simulado_id = v_sid;
  IF v_count <> 180 THEN RAISE EXCEPTION 'FALHOU: count != 180, veio %', v_count; END IF;

  SELECT COUNT(*) INTO v_lc FROM public.simulado_itens
  WHERE simulado_id = v_sid AND area = 'LC';
  SELECT COUNT(*) INTO v_mt FROM public.simulado_itens
  WHERE simulado_id = v_sid AND area = 'MT';
  IF v_lc <> 45 OR v_mt <> 45 THEN
    RAISE EXCEPTION 'FALHOU: distribuicao de areas errada (LC=%, MT=%)', v_lc, v_mt;
  END IF;

  RAISE NOTICE 'OK: simulado % criado com 180 itens, 45 por area.', v_sid;

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sid;
END $$;

\echo ''
\echo '[CREATE-TEST 3] coordinator cria simulado na propria escola -> sucesso'
DO $$
DECLARE v_sid uuid;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);

  SELECT public.create_simulado_with_items(
    'Coord cria para escola A',
    '11111111-1111-1111-1111-111111111111',
    ARRAY['3A']::text[],
    pg_temp.make_180_items()
  ) INTO v_sid;

  IF NOT EXISTS (SELECT 1 FROM public.simulados WHERE id = v_sid AND turmas = ARRAY['3A']) THEN
    RAISE EXCEPTION 'FALHOU: simulado com turmas=[3A] nao encontrado';
  END IF;

  RAISE NOTICE 'OK: coordinator criou simulado na propria escola com turmas=[3A].';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sid;
END $$;

\echo ''
\echo '[CREATE-TEST 4] coordinator tenta criar simulado em OUTRA escola -> insufficient_privilege'
DO $$
DECLARE v_caught boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);

  BEGIN
    PERFORM public.create_simulado_with_items(
      'Coord B tenta',
      '22222222-2222-2222-2222-222222222222',  -- escola B
      ARRAY[]::text[],
      pg_temp.make_180_items()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FALHOU: coord deveria ser impedido de criar na escola B';
  END IF;
  RAISE NOTICE 'OK: coord impedido de criar na escola B (insufficient_privilege).';

  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

\echo ''
\echo '[CREATE-TEST 5] title vazio -> check_violation'
DO $$
DECLARE v_caught boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  BEGIN
    PERFORM public.create_simulado_with_items(
      '   ',
      '11111111-1111-1111-1111-111111111111',
      ARRAY[]::text[],
      pg_temp.make_180_items()
    );
  EXCEPTION WHEN check_violation THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN RAISE EXCEPTION 'FALHOU: title vazio deveria ter sido bloqueado'; END IF;
  RAISE NOTICE 'OK: title vazio bloqueado.';
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

\echo ''
\echo '[CREATE-TEST 6] items com menos de 180 elementos -> check_violation + rollback'
DO $$
DECLARE v_caught boolean := false; v_partial jsonb; v_count_before int; v_count_after int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  -- Monta payload com so 10 itens
  SELECT jsonb_agg(
    jsonb_build_object('numero', n, 'gabarito', 'A', 'dificuldade', 3)
    ORDER BY n
  ) INTO v_partial FROM generate_series(1, 10) n;

  SELECT COUNT(*) INTO v_count_before FROM public.simulados;

  BEGIN
    PERFORM public.create_simulado_with_items(
      'Incompleto',
      '11111111-1111-1111-1111-111111111111',
      ARRAY[]::text[],
      v_partial
    );
  EXCEPTION WHEN check_violation THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN RAISE EXCEPTION 'FALHOU: 10 itens deveria ser bloqueado'; END IF;

  -- Rollback garantido pela funcao: nenhum simulado novo persistiu
  SELECT COUNT(*) INTO v_count_after FROM public.simulados;
  IF v_count_after <> v_count_before THEN
    RAISE EXCEPTION 'FALHOU: rollback falhou (before=%, after=%)', v_count_before, v_count_after;
  END IF;
  RAISE NOTICE 'OK: payload parcial bloqueado + rollback atomico.';
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

\echo ''
\echo '[CREATE-TEST 7] gabarito invalido -> check_violation + rollback'
DO $$
DECLARE v_caught boolean := false; v_items jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  -- Payload com um item tendo gabarito=F (invalido)
  SELECT jsonb_agg(
    CASE WHEN n = 50
      THEN jsonb_build_object('numero', n, 'gabarito', 'F', 'dificuldade', 3)
      ELSE jsonb_build_object('numero', n, 'gabarito', 'A', 'dificuldade', 3)
    END ORDER BY n
  ) INTO v_items FROM generate_series(1, 180) n;

  BEGIN
    PERFORM public.create_simulado_with_items(
      'Com gabarito errado',
      '11111111-1111-1111-1111-111111111111',
      ARRAY[]::text[],
      v_items
    );
  EXCEPTION WHEN check_violation THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN RAISE EXCEPTION 'FALHOU: gabarito=F deveria quebrar o CHECK'; END IF;
  RAISE NOTICE 'OK: gabarito invalido disparou check_violation (rollback atomico).';
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

\echo ''
\echo '[CREATE-TEST 8] student nao pode criar (insufficient_privilege)'
DO $$
DECLARE v_caught boolean := false;
BEGIN
  -- Student (sem role em project_users para o super_admin/coordinator)
  -- Usa um auth.uid sem linha em project_users -> v_role sera NULL
  PERFORM set_config('request.jwt.claims',
    '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);

  BEGIN
    PERFORM public.create_simulado_with_items(
      'Student tenta',
      '11111111-1111-1111-1111-111111111111',
      ARRAY[]::text[],
      pg_temp.make_180_items()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN RAISE EXCEPTION 'FALHOU: user sem role deveria ser bloqueado'; END IF;
  RAISE NOTICE 'OK: user sem role em project_users bloqueado.';
  PERFORM set_config('request.jwt.claims', NULL, true);
END $$;

\echo ''
\echo '[CREATE-TEST 9] topico e salvo corretamente + habilidade NULL'
DO $$
DECLARE v_sid uuid; v_item record;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  SELECT public.create_simulado_with_items(
    'Com topicos',
    '11111111-1111-1111-1111-111111111111',
    ARRAY[]::text[],
    pg_temp.make_180_items()
  ) INTO v_sid;

  SELECT numero, area, topico, habilidade INTO v_item
  FROM public.simulado_itens
  WHERE simulado_id = v_sid AND numero = 10;

  IF v_item.area <> 'LC' THEN RAISE EXCEPTION 'FALHOU: area do numero 10 = %', v_item.area; END IF;
  IF v_item.topico <> 'Topico LC' THEN RAISE EXCEPTION 'FALHOU: topico do numero 10 = %', v_item.topico; END IF;
  IF v_item.habilidade IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: habilidade deveria ser NULL, veio %', v_item.habilidade; END IF;

  RAISE NOTICE 'OK: topico preservado, habilidade NULL (nao veio no payload).';
  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sid;
END $$;

\echo ''
\echo '[CREATE-TEST 10] turmas default vazio quando p_turmas=NULL'
DO $$
DECLARE v_sid uuid; v_turmas text[];
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

  SELECT public.create_simulado_with_items(
    'Sem turmas',
    '11111111-1111-1111-1111-111111111111',
    NULL,
    pg_temp.make_180_items()
  ) INTO v_sid;

  SELECT turmas INTO v_turmas FROM public.simulados WHERE id = v_sid;
  IF cardinality(v_turmas) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: turmas deveria ser array vazio, veio %', v_turmas;
  END IF;
  RAISE NOTICE 'OK: turmas=NULL normalizado para array vazio.';
  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sid;
END $$;

COMMIT;

\echo ''
\echo '=============================================='
\echo '=== CREATE RPC ASSERTIONS: 10/10 blocks OK ==='
\echo '=============================================='
