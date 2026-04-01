-- Migration: Fix RLS policies — aluno_id is matricula (TEXT), not auth.uid() (UUID)
--
-- Problem: The database had policies like:
--   user_manage_own_cronogramas: aluno_id = (auth.uid())::text
--
-- But aluno_id stores the student's matricula (e.g. "123456"),
-- while auth.uid() returns a Supabase Auth UUID (e.g. "a1b2c3d4-...").
-- These NEVER match → every INSERT/UPDATE by teachers fails with RLS 403.
--
-- Fix: Replace the broken user-own policies with permissive authenticated-only checks.
-- Super admin and school_admin policies are preserved (they already work correctly).

-- ---------------------------------------------------------------------------
-- cronogramas: fix INSERT/UPDATE/DELETE policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_manage_own_cronogramas" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_select" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_insert" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_update" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_delete" ON cronogramas;

CREATE POLICY "cronogramas_authenticated_all"
ON cronogramas
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- blocos_cronograma: fix INSERT/UPDATE/DELETE policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_manage_own_blocos" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_select" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_insert" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_update" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_delete" ON blocos_cronograma;

CREATE POLICY "blocos_authenticated_all"
ON blocos_cronograma
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
