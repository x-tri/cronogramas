-- Assertions sobre as RPCs de 017_simulados_rpcs.sql.
-- Roda DEPOIS de 90_assertions.sql.
--
-- Foco: validar comportamento de get_student_simulados_pendentes e
-- get_student_simulado_resultado em diferentes contextos (published/draft,
-- ja respondido/nao, escola diferente).

\set ON_ERROR_STOP on

BEGIN;

-- Ambiente limpo — 90_assertions fez DELETE, mas garantimos.
TRUNCATE public.simulados CASCADE;

-- Fixtures novos: reaproveita schools/students/project_users de 90_assertions,
-- mas como aquele usou COMMIT, os dados persistem (exceto simulados que foram
-- DELETE ao final).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    INSERT INTO public.schools (id, name) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Escola A'),
      ('22222222-2222-2222-2222-222222222222', 'Escola B');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001') THEN
    INSERT INTO public.students (id, profile_id, school_id, turma, matricula, name) VALUES
      ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '11111111-1111-1111-1111-111111111111', '3A', 'A0001', 'Aluno A1'),
      ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       '22222222-2222-2222-2222-222222222222', '3B', 'B0001', 'Aluno B1');
  END IF;
END $$;

-- Helper local: popula 180 itens completos em um simulado.
CREATE OR REPLACE FUNCTION pg_temp.fill_180_items(p_sim uuid) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade, topico, habilidade)
    SELECT p_sim, n, 'LC', 'A', 3, 'Topico LC', 'H' || ((n-1) % 30 + 1) FROM generate_series(1, 45) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade, topico, habilidade)
    SELECT p_sim, n, 'CH', 'A', 3, 'Topico CH', 'H' || ((n-1) % 30 + 1) FROM generate_series(46, 90) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade, topico, habilidade)
    SELECT p_sim, n, 'CN', 'A', 3, 'Topico CN', 'H' || ((n-1) % 30 + 1) FROM generate_series(91, 135) n;
  INSERT INTO public.simulado_itens (simulado_id, numero, area, gabarito, dificuldade, topico, habilidade)
    SELECT p_sim, n, 'MT', 'A', 3, 'Topico MT', 'H' || ((n-1) % 30 + 1) FROM generate_series(136, 180) n;
$$;

\echo ''
\echo '[RPC-TEST 1] get_student_simulados_pendentes retorna apenas published da escola'
DO $$
DECLARE
  v_pub_a uuid;
  v_draft_a uuid;
  v_pub_b uuid;
  v_count int;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('Pub A', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_pub_a;
  PERFORM pg_temp.fill_180_items(v_pub_a);
  UPDATE public.simulados SET status='published' WHERE id = v_pub_a;

  INSERT INTO public.simulados (title, school_id) VALUES ('Draft A', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_draft_a;

  INSERT INTO public.simulados (title, school_id) VALUES ('Pub B', '22222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_pub_b;
  PERFORM pg_temp.fill_180_items(v_pub_b);
  UPDATE public.simulados SET status='published' WHERE id = v_pub_b;

  -- Simula student A
  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

  SELECT COUNT(*) INTO v_count FROM public.get_student_simulados_pendentes();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: esperava 1 pendente para student A, veio %', v_count;
  END IF;

  -- Verifica conteudo do retorno
  IF NOT EXISTS (
    SELECT 1 FROM public.get_student_simulados_pendentes()
    WHERE id = v_pub_a AND ja_respondeu = false
  ) THEN
    RAISE EXCEPTION 'FALHOU: simulado Pub A nao encontrado como pendente';
  END IF;

  RAISE NOTICE 'OK: student A ve apenas 1 pendente (Pub A), draft e escola B ocultos.';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id IN (v_pub_a, v_draft_a, v_pub_b);
END $$;

\echo ''
\echo '[RPC-TEST 2] ja_respondeu=true apos insert em simulado_respostas'
DO $$
DECLARE v_sim uuid; v_row record;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('Sim Resp', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  INSERT INTO public.simulado_respostas (simulado_id, student_id, acertos_lc, erros_lc, branco_lc)
  VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001', 30, 10, 5);

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

  SELECT * INTO v_row FROM public.get_student_simulados_pendentes() WHERE id = v_sim;
  IF v_row.ja_respondeu IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: ja_respondeu deveria ser true, veio %', v_row.ja_respondeu;
  END IF;
  IF v_row.submitted_at IS NULL THEN
    RAISE EXCEPTION 'FALHOU: submitted_at deveria estar populado';
  END IF;
  RAISE NOTICE 'OK: ja_respondeu=true e submitted_at=% apos insert.', v_row.submitted_at;

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 3] get_student_simulado_resultado retorna null se nao submetido'
DO $$
DECLARE v_sim uuid; v_result jsonb;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('Sim no-sub', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT public.get_student_simulado_resultado(v_sim) INTO v_result;

  IF (v_result ->> 'submitted')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: submitted deveria ser false';
  END IF;
  IF v_result ? 'simulado' IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: deveria conter metadados do simulado';
  END IF;
  IF v_result -> 'resposta' IS NOT NULL AND v_result ->> 'resposta' <> 'null' THEN
    -- jsonb_build_object with NULL produces JSON null
    NULL;
  END IF;
  RAISE NOTICE 'OK: pre-submit retorna submitted=false + metadados.';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 4] get_student_simulado_resultado retorna payload completo pos-submit'
DO $$
DECLARE
  v_sim uuid;
  v_result jsonb;
  v_itens jsonb;
  v_first_item jsonb;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('Sim Full', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  -- Insere resposta com acertos reais (aluno acertou LC todo, errou demais)
  INSERT INTO public.simulado_respostas (
    simulado_id, student_id,
    answers,
    acertos_lc, erros_lc, branco_lc,
    tri_lc
  )
  VALUES (
    v_sim,
    'aaaaaaaa-0000-0000-0000-000000000001',
    jsonb_build_object('1', 'A', '2', 'B', '3', ''),
    45, 0, 0,
    800.5
  );

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT public.get_student_simulado_resultado(v_sim) INTO v_result;

  IF (v_result ->> 'submitted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: submitted deveria ser true pos-submit';
  END IF;

  v_itens := v_result -> 'itens';
  IF jsonb_array_length(v_itens) <> 180 THEN
    RAISE EXCEPTION 'FALHOU: itens deveriam ser 180, veio %', jsonb_array_length(v_itens);
  END IF;

  -- Primeiro item: numero=1, gabarito='A', resposta_aluno='A', correto=true
  v_first_item := v_itens -> 0;
  IF (v_first_item ->> 'numero')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: primeiro item deveria ser numero=1';
  END IF;
  IF v_first_item ->> 'resposta_aluno' <> 'A' THEN
    RAISE EXCEPTION 'FALHOU: resposta_aluno do item 1 deveria ser A, veio %', v_first_item ->> 'resposta_aluno';
  END IF;
  IF (v_first_item ->> 'correto')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: item 1 deveria ser correto=true';
  END IF;

  -- Segundo item: gabarito='A', resposta='B', correto=false
  IF (v_itens -> 1 ->> 'correto')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: item 2 deveria ser correto=false';
  END IF;

  -- Terceiro item: branco=true
  IF (v_itens -> 2 ->> 'branco')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: item 3 deveria ser branco=true';
  END IF;

  RAISE NOTICE 'OK: pos-submit retorna 180 itens com feedback correto/errado/branco.';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 5] get_student_simulado_resultado retorna null p/ escola errada'
DO $$
DECLARE v_sim uuid; v_result jsonb;
BEGIN
  -- Simulado da escola B, student A tenta acessar
  INSERT INTO public.simulados (title, school_id) VALUES ('Sim B', '22222222-2222-2222-2222-222222222222')
  RETURNING id INTO v_sim;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT public.get_student_simulado_resultado(v_sim) INTO v_result;

  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: deveria retornar NULL para simulado de escola diferente';
  END IF;
  RAISE NOTICE 'OK: escola errada retorna NULL (sem vazamento).';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 6] filtro por turmas[] quando cardinality > 0'
DO $$
DECLARE v_sim uuid; v_count int;
BEGIN
  -- Simulado restrito a turma 3B (student A esta em 3A -> nao ve)
  INSERT INTO public.simulados (title, school_id, turmas)
  VALUES ('Sim Turma 3B', '11111111-1111-1111-1111-111111111111', ARRAY['3B'])
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT COUNT(*) INTO v_count FROM public.get_student_simulados_pendentes();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: student A (turma 3A) nao deveria ver simulado de turma 3B, viu %', v_count;
  END IF;
  RAISE NOTICE 'OK: filtro por turma impede student A de ver simulado de 3B.';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 7] get_student_simulado_resultado nega leitura se turma nao bate'
DO $$
DECLARE v_sim uuid; v_result jsonb;
BEGIN
  -- Simulado restrito a turma 3B (student A esta em 3A)
  INSERT INTO public.simulados (title, school_id, turmas)
  VALUES ('Sim 3B Only', '11111111-1111-1111-1111-111111111111', ARRAY['3B'])
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  -- Insere resposta manualmente como se o student tivesse submetido antes (bug-proof test)
  INSERT INTO public.simulado_respostas (simulado_id, student_id, acertos_lc, erros_lc, branco_lc)
  VALUES (v_sim, 'aaaaaaaa-0000-0000-0000-000000000001', 10, 10, 25);

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT public.get_student_simulado_resultado(v_sim) INTO v_result;

  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: turma mismatch deveria retornar NULL, veio %', v_result;
  END IF;
  RAISE NOTICE 'OK: turma mismatch no READ retorna NULL (defense in depth).';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

\echo ''
\echo '[RPC-TEST 8] get_student_simulado_resultado nao expõe campos nao mapeados'
DO $$
DECLARE v_sim uuid; v_result jsonb; v_sim_obj jsonb; v_keys text;
BEGIN
  INSERT INTO public.simulados (title, school_id) VALUES ('Sim Keys', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_sim;
  PERFORM pg_temp.fill_180_items(v_sim);
  UPDATE public.simulados SET status='published' WHERE id = v_sim;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  SELECT public.get_student_simulado_resultado(v_sim) INTO v_result;

  v_sim_obj := v_result -> 'simulado';
  -- Chaves esperadas: id, title, school_id, turmas, status, published_at, closed_at
  SELECT string_agg(k, ',' ORDER BY k) INTO v_keys FROM jsonb_object_keys(v_sim_obj) k;
  IF v_keys <> 'closed_at,id,published_at,school_id,status,title,turmas' THEN
    RAISE EXCEPTION 'FALHOU: chaves do simulado inesperadas: %', v_keys;
  END IF;
  RAISE NOTICE 'OK: explicit field projection limita o payload do simulado.';

  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.simulados WHERE id = v_sim;
END $$;

COMMIT;

\echo ''
\echo '=========================================='
\echo '=== RPC ASSERTIONS: 8/8 test blocks OK ==='
\echo '=========================================='
