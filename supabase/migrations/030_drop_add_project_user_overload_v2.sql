-- Migration 030: drop overload V2 de add_project_user (resolve PGRST203)
--
-- Contexto:
--   Frontend (admin-coordenadores.tsx:407) recebia HTTP 300 PGRST203
--   ("Could not choose the best candidate function") em alguns cenarios,
--   surgindo no console como erro "404" via supabase-js. Causa: 2 overloads
--   coexistiam no banco com mesma resolucao para chamadas que omitem
--   p_password do payload:
--
--     V1 (manter):  (text, uuid, text, text, text[], text)   -- com p_password DEFAULT NULL
--     V2 (dropar):  (text, uuid, text, text, text[])         -- sem p_password
--
-- Analise comparativa (2026-05-01) — V1 e superset estrito de V2:
--   * Mesmo guard de seguranca: is_project_super_admin()
--   * Mesma FK check: schools(id)
--   * V1 com p_password=NULL executa o caminho de V2 + extras:
--     - Gera invite_code para novos users sem senha (V2 nao gerava — usuarios
--       criados via V2 ficavam sem como entrar no sistema; bug latente).
--     - Cria conta em auth.users + auth.identities quando p_password fornecida
--       (caso novo de V1, nao existia em V2).
--   * Mesma resposta jsonb com campos compativeis (V1 adiciona invite_code
--     opcional — nullable, backward compat).
--
-- Decisao PO 2026-05-01: drop V2 — elimina ambiguidade do PostgREST e melhora
-- UX (novos usuarios sem senha agora SEMPRE recebem invite_code).
--
-- Defensivo: guard com COUNT antes/depois. Aborta se encontrar quantidades
-- inesperadas de overloads.

DO $$
DECLARE
  v_count_before int;
  v_count_after int;
BEGIN
  SELECT COUNT(*) INTO v_count_before
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'add_project_user';

  IF v_count_before <> 2 THEN
    RAISE EXCEPTION
      'Migration 030 abortada: esperado 2 overloads de add_project_user antes do drop, encontrado %. Investigar antes de prosseguir.',
      v_count_before;
  END IF;

  -- Drop especifico da V2 (5 args, sem p_password)
  DROP FUNCTION IF EXISTS public.add_project_user(text, uuid, text, text, text[]);

  SELECT COUNT(*) INTO v_count_after
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'add_project_user';

  IF v_count_after <> 1 THEN
    RAISE EXCEPTION
      'Migration 030 falhou: apos drop esperado 1 overload, encontrado %.',
      v_count_after;
  END IF;

  RAISE NOTICE 'Migration 030: V2 (5 args) dropada com sucesso. V1 (6 args) permanece como unica.';
END $$;
