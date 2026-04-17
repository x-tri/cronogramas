-- Assertions sobre 015 e 016.
-- Espera que 00_fixtures.sql, 015_*.sql e 016_*.sql ja tenham rodado.
--
-- Cada bloco DO representa um caso de teste; RAISE EXCEPTION se a assertiva falha.
-- Sucesso => final "=== ALL PASSED ===".

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Setup: 2 escolas, alunos, coordenadores.
-- ---------------------------------------------------------------------------
INSERT INTO public.schools (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Escola A'),
  ('22222222-2222-2222-2222-222222222222', 'Escola B');

INSERT INTO public.students (id, profile_id, school_id, turma, matricula, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', '3A', 'A0001', 'Aluno A1'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', '3B', 'B0001', 'Aluno B1');

INSERT INTO public.project_users (auth_uid, email, name, school_id, role, is_active) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'super@xtri.com', 'Super', NULL, 'super_admin', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'coordA@xtri.com', 'Coord A',
   '11111111-1111-1111-1111-111111111111', 'coordinator', true);

\echo ''
\echo '[TEST 1] CHECK numero<->area consistency em simulado_itens'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S1', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    -- numero=1 deveria ser LC, passando CH quebra o CHECK
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 1, 'CH', 'A', 3);
    RAISE EXCEPTION 'FALHOU: INSERT inconsistente (numero=1 area=CH) deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK numero<->area bloqueou (numero=1 area=CH).';
  END;

  BEGIN
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 100, 'MT', 'A', 3);
    RAISE EXCEPTION 'FALHOU: INSERT inconsistente (numero=100 area=MT) deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK numero<->area bloqueou (numero=100 area=MT, esperado CN).';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 2] Trigger impede publicar sem 180 itens'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S2', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    UPDATE public.simulados SET status = 'published' WHERE id = v_sim;
    RAISE EXCEPTION 'FALHOU: publicar sem itens deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: trigger bloqueou publicar sem itens.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 3] Trigger impede publicar com menos de 45 por area'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S3', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  -- So LC (45 itens), faltando CH/CN/MT
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  SELECT v_sim, n, 'LC', 'A', 3 FROM generate_series(1, 45) AS n;

  BEGIN
    UPDATE public.simulados SET status = 'published' WHERE id = v_sim;
    RAISE EXCEPTION 'FALHOU: publicar com 45 itens (so LC) deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: trigger bloqueou publicar parcial (45 LC apenas).';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 4] Publicar com 180 itens (45 por area) sucede e popula published_at'
DO $$
DECLARE v_sim uuid; v_published_at timestamptz;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S4', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  SELECT v_sim, n, 'LC', 'A', 3 FROM generate_series(1,   45) AS n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  SELECT v_sim, n, 'CH', 'A', 3 FROM generate_series(46,  90) AS n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  SELECT v_sim, n, 'CN', 'A', 3 FROM generate_series(91,  135) AS n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  SELECT v_sim, n, 'MT', 'A', 3 FROM generate_series(136, 180) AS n;

  UPDATE public.simulados SET status = 'published' WHERE id = v_sim;

  SELECT published_at INTO v_published_at FROM public.simulados WHERE id = v_sim;
  IF v_published_at IS NULL THEN
    RAISE EXCEPTION 'FALHOU: published_at nao foi populado';
  END IF;
  RAISE NOTICE 'OK: publicar com 180 itens funcionou, published_at=%', v_published_at;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 5] simulado_respostas CHECK acertos+erros+branco=45 por area'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S5', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    INSERT INTO public.simulado_respostas (simulado_id, student_id, answers, acertos_lc, erros_lc, branco_lc)
    VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb, 20, 20, 20);  -- soma 60 != 45
    RAISE EXCEPTION 'FALHOU: soma 60 deveria ter sido bloqueada';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK totais LC=45 bloqueou soma 60.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 6] simulado_respostas CHECK tri ∈ [200, 1000]'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S6', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    INSERT INTO public.simulado_respostas (simulado_id, student_id, tri_lc)
    VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001', 150);  -- abaixo de 200
    RAISE EXCEPTION 'FALHOU: tri=150 deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK tri_lc>=200 bloqueou valor 150.';
  END;

  BEGIN
    INSERT INTO public.simulado_respostas (simulado_id, student_id, tri_mt)
    VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001', 1200);  -- acima de 1000
    RAISE EXCEPTION 'FALHOU: tri=1200 deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK tri_mt<=1000 bloqueou valor 1200.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 7] UNIQUE (simulado_id, student_id) impede dupla submissao'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S7', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  INSERT INTO public.simulado_respostas (simulado_id, student_id)
  VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001');

  BEGIN
    INSERT INTO public.simulado_respostas (simulado_id, student_id)
    VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FALHOU: segunda insercao deveria ter sido bloqueada';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: UNIQUE bloqueou dupla submissao.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 8] gabarito CHECK: apenas A-E'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S8', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 1, 'LC', 'F', 3);  -- F nao valido
    RAISE EXCEPTION 'FALHOU: gabarito=F deveria ter sido bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK gabarito A-E bloqueou F.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 9] dificuldade CHECK: 1-5'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S9', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  BEGIN
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 1, 'LC', 'A', 0);  -- 0 fora da faixa 1-5
    RAISE EXCEPTION 'FALHOU: dificuldade=0 deveria ter sido bloqueada';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK dificuldade 1-5 bloqueou 0.';
  END;

  BEGIN
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 1, 'LC', 'A', 6);
    RAISE EXCEPTION 'FALHOU: dificuldade=6 deveria ter sido bloqueada';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK dificuldade 1-5 bloqueou 6.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 10] UNIQUE (simulado_id, numero)'
DO $$
DECLARE v_sim uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S10', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  VALUES (v_sim, 5, 'LC', 'A', 3);

  BEGIN
    INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    VALUES (v_sim, 5, 'LC', 'B', 2);
    RAISE EXCEPTION 'FALHOU: numero duplicado deveria ter sido bloqueado';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: UNIQUE (simulado_id, numero) bloqueou duplicata.';
  END;

  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[TEST 11] ON DELETE CASCADE em simulado_itens'
DO $$
DECLARE v_sim uuid; v_count int;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('S11', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
  VALUES (v_sim, 1, 'LC', 'A', 3), (v_sim, 2, 'LC', 'B', 3);

  DELETE FROM public.simulados WHERE id = v_sim;

  SELECT COUNT(*) INTO v_count FROM public.simulado_itens WHERE simulado_id = v_sim;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: itens deveriam ter sido apagados em cascade (count=%)', v_count;
  END IF;
  RAISE NOTICE 'OK: ON DELETE CASCADE funcionou.';
END $$;

\echo ''
\echo '[TEST 12] RLS: super_admin enxerga todos os simulados'
DO $$
DECLARE v_sim_a uuid; v_sim_b uuid; v_count int;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('SA', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim_a;
  INSERT INTO public.simulados (title, school_id) VALUES ('SB', '22222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_sim_b;

  -- Simula JWT do super_admin
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.simulados;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FALHOU: super_admin deveria ver 2 simulados, viu %', v_count;
  END IF;
  RAISE NOTICE 'OK: super_admin ve todos (count=%)', v_count;

  RESET ROLE;
  DELETE FROM public.simulados WHERE id IN (v_sim_a, v_sim_b);
END $$;

\echo ''
\echo '[TEST 13] RLS: coordinator so ve simulados da sua escola'
DO $$
DECLARE v_sim_a uuid; v_sim_b uuid; v_count int; v_found_school uuid;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('SA', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim_a;
  INSERT INTO public.simulados (title, school_id) VALUES ('SB', '22222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_sim_b;

  -- Simula JWT do coord A (escola 11111111...)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.simulados;
  SELECT school_id INTO v_found_school FROM public.simulados LIMIT 1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: coord A deveria ver 1 simulado, viu %', v_count;
  END IF;
  IF v_found_school::text <> '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'FALHOU: coord A viu escola errada: %', v_found_school;
  END IF;
  RAISE NOTICE 'OK: coord A so ve escola A.';

  RESET ROLE;
  DELETE FROM public.simulados WHERE id IN (v_sim_a, v_sim_b);
END $$;

\echo ''
\echo '[TEST 14] RLS: student so ve simulados published da sua escola'
DO $$
DECLARE v_sim_draft uuid; v_sim_pub_a uuid; v_sim_pub_b uuid; v_count int;
BEGIN
  -- Escola A, draft (nao deveria aparecer p/ student)
  INSERT INTO public.simulados (title, school_id) VALUES ('draft A', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim_draft;

  -- Escola A, published (completa 180 itens primeiro)
  INSERT INTO public.simulados (title, school_id) VALUES ('pub A', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim_pub_a;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_a, n, 'LC', 'A', 3 FROM generate_series(1, 45) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_a, n, 'CH', 'A', 3 FROM generate_series(46, 90) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_a, n, 'CN', 'A', 3 FROM generate_series(91, 135) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_a, n, 'MT', 'A', 3 FROM generate_series(136, 180) n;
  UPDATE public.simulados SET status='published' WHERE id = v_sim_pub_a;

  -- Escola B, published
  INSERT INTO public.simulados (title, school_id) VALUES ('pub B', '22222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_sim_pub_b;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_b, n, 'LC', 'A', 3 FROM generate_series(1, 45) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_b, n, 'CH', 'A', 3 FROM generate_series(46, 90) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_b, n, 'CN', 'A', 3 FROM generate_series(91, 135) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim_pub_b, n, 'MT', 'A', 3 FROM generate_series(136, 180) n;
  UPDATE public.simulados SET status='published' WHERE id = v_sim_pub_b;

  -- Simula student A (escola A)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.simulados;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: student A deveria ver 1 simulado (pub A), viu %', v_count;
  END IF;
  RAISE NOTICE 'OK: student A ve apenas pub A (draft e pub B ocultos).';

  RESET ROLE;
  DELETE FROM public.simulados WHERE id IN (v_sim_draft, v_sim_pub_a, v_sim_pub_b);
END $$;

\echo ''
\echo '[TEST 15] Helper validate_simulado_complete retorna false/true corretamente'
DO $$
DECLARE v_sim uuid; v_ok boolean;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('VC', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;

  SELECT public.validate_simulado_complete(v_sim) INTO v_ok;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: esperava false para simulado vazio'; END IF;

  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim, n, 'LC', 'A', 3 FROM generate_series(1, 45) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim, n, 'CH', 'A', 3 FROM generate_series(46, 90) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim, n, 'CN', 'A', 3 FROM generate_series(91, 135) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade)
    SELECT v_sim, n, 'MT', 'A', 3 FROM generate_series(136, 180) n;

  SELECT public.validate_simulado_complete(v_sim) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: esperava true para simulado completo'; END IF;

  RAISE NOTICE 'OK: validate_simulado_complete (false vazio, true completo).';
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

COMMIT;

\echo ''
\echo '=========================================='
\echo '=== ALL PASSED: 15/15 test blocks OK   ==='
\echo '=========================================='
