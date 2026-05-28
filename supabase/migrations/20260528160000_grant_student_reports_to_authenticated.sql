-- Migration: adiciona GRANT faltante em student_reports
--
-- Sintoma: HTTP 403 nas queries de student_reports mesmo com sessão válida.
-- Causa: tabela criada sem GRANT explícito para o role authenticated.
--
-- Em PostgREST/Supabase:
--   • GRANT faltando           → 403 Forbidden  ← o que estava acontecendo
--   • RLS bloqueando (policy)  → 200 + [] (array vazio)
--
-- As políticas RLS corretas já existem (migration 033). Faltava apenas
-- a permissão em nível de tabela para que o PostgREST conseguisse
-- sequer executar a query.

GRANT SELECT, INSERT ON public.student_reports TO authenticated;
