-- Migration: Harden RLS policies (authenticated-only)
-- Goal: prevent anonymous access to sensitive study data tables

-- ---------------------------------------------------------------------------
-- cronogramas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all cronogramas" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_select" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_insert" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_update" ON cronogramas;
DROP POLICY IF EXISTS "cronogramas_authenticated_delete" ON cronogramas;

CREATE POLICY "cronogramas_authenticated_select"
ON cronogramas
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "cronogramas_authenticated_insert"
ON cronogramas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cronogramas_authenticated_update"
ON cronogramas
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cronogramas_authenticated_delete"
ON cronogramas
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- blocos_cronograma
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all blocos" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_select" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_insert" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_update" ON blocos_cronograma;
DROP POLICY IF EXISTS "blocos_authenticated_delete" ON blocos_cronograma;

CREATE POLICY "blocos_authenticated_select"
ON blocos_cronograma
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "blocos_authenticated_insert"
ON blocos_cronograma
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "blocos_authenticated_update"
ON blocos_cronograma
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "blocos_authenticated_delete"
ON blocos_cronograma
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- horarios_oficiais
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read horarios" ON horarios_oficiais;
DROP POLICY IF EXISTS "Allow all horarios" ON horarios_oficiais;
DROP POLICY IF EXISTS "horarios_authenticated_select" ON horarios_oficiais;
DROP POLICY IF EXISTS "horarios_authenticated_insert" ON horarios_oficiais;
DROP POLICY IF EXISTS "horarios_authenticated_update" ON horarios_oficiais;
DROP POLICY IF EXISTS "horarios_authenticated_delete" ON horarios_oficiais;

CREATE POLICY "horarios_authenticated_select"
ON horarios_oficiais
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "horarios_authenticated_insert"
ON horarios_oficiais
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "horarios_authenticated_update"
ON horarios_oficiais
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "horarios_authenticated_delete"
ON horarios_oficiais
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- alunos_xtris
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all alunos_xtris" ON alunos_xtris;
DROP POLICY IF EXISTS "alunos_xtris_authenticated_select" ON alunos_xtris;
DROP POLICY IF EXISTS "alunos_xtris_authenticated_insert" ON alunos_xtris;
DROP POLICY IF EXISTS "alunos_xtris_authenticated_update" ON alunos_xtris;
DROP POLICY IF EXISTS "alunos_xtris_authenticated_delete" ON alunos_xtris;

CREATE POLICY "alunos_xtris_authenticated_select"
ON alunos_xtris
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "alunos_xtris_authenticated_insert"
ON alunos_xtris
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "alunos_xtris_authenticated_update"
ON alunos_xtris
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "alunos_xtris_authenticated_delete"
ON alunos_xtris
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- RPC hardening: get_school_names
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION get_school_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION get_school_names(uuid[]) TO authenticated;

ALTER FUNCTION get_school_names(uuid[]) SET search_path = public;
