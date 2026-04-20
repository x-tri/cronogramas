-- Migration: RLS policies for simulados / simulado_itens / simulado_respostas (Fase 1)
-- Goal: proteger os dados do simulado por papel e escopo de escola/turma.
--
-- Regras:
--   * simulados:
--       - super_admin: CRUD total
--       - coordinator: CRUD apenas da sua escola (current_school_id())
--       - student: SELECT apenas quando status='published' AND pertence a escola/turma alvo
--   * simulado_itens:
--       - super_admin + coordinator (da escola dona do simulado): CRUD
--       - student: SEM acesso direto (gabarito oculto — leitura via Edge Function)
--   * simulado_respostas:
--       - super_admin + coordinator (da escola): SELECT
--       - student: SELECT apenas das proprias
--       - INSERT/UPDATE: feito exclusivamente via Edge Function (service_role) na Fase 2.
--         Clientes sao bloqueados por padrao.
--
-- Helpers usados: is_super_admin(), current_school_id(), current_project_role()
-- (definidos em 008_create_mentor_intelligence_tables.sql).

-- ---------------------------------------------------------------------------
-- Helper: student_school_id()
-- Retorna o school_id do aluno logado (via students.profile_id = auth.uid()).
--
-- ORDER BY id garante determinismo caso existam duplicatas inesperadas
-- (evita que o planner escolha uma linha arbitraria e "vaze" simulados
-- de outra escola para o aluno).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.school_id
  FROM public.students s
  WHERE s.profile_id = auth.uid()
  ORDER BY s.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.student_school_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_school_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: student_turma()
-- Retorna a turma do aluno logado. ORDER BY id pelos mesmos motivos de
-- student_school_id().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_turma()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.turma
  FROM public.students s
  WHERE s.profile_id = auth.uid()
  ORDER BY s.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.student_turma() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_turma() TO authenticated;

-- ---------------------------------------------------------------------------
-- simulados — RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulados_admin_all"          ON public.simulados;
DROP POLICY IF EXISTS "simulados_coord_school_all"   ON public.simulados;
DROP POLICY IF EXISTS "simulados_student_view"       ON public.simulados;

-- super_admin: acesso total
CREATE POLICY "simulados_admin_all"
ON public.simulados
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- coordinator: CRUD dentro da propria escola
CREATE POLICY "simulados_coord_school_all"
ON public.simulados
FOR ALL
TO authenticated
USING (
  public.current_project_role() = 'coordinator'
  AND school_id = public.current_school_id()
)
WITH CHECK (
  public.current_project_role() = 'coordinator'
  AND school_id = public.current_school_id()
);

-- student: SELECT apenas published da sua escola/turma
CREATE POLICY "simulados_student_view"
ON public.simulados
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND school_id = public.student_school_id()
  AND (
    cardinality(turmas) = 0
    OR public.student_turma() = ANY(turmas)
  )
);

-- ---------------------------------------------------------------------------
-- simulado_itens — RLS
-- Somente admins/coords (da escola). Aluno NUNCA le direto — gabarito oculto.
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulado_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulado_itens_admin_all"         ON public.simulado_itens;
DROP POLICY IF EXISTS "simulado_itens_coord_school_all"  ON public.simulado_itens;

CREATE POLICY "simulado_itens_admin_all"
ON public.simulado_itens
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "simulado_itens_coord_school_all"
ON public.simulado_itens
FOR ALL
TO authenticated
USING (
  public.current_project_role() = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_itens.simulado_id
      AND s.school_id = public.current_school_id()
  )
)
WITH CHECK (
  public.current_project_role() = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_itens.simulado_id
      AND s.school_id = public.current_school_id()
  )
);

-- ---------------------------------------------------------------------------
-- simulado_respostas — RLS
-- Student: SELECT proprias. Admin/coord: SELECT da escola.
-- INSERT/UPDATE/DELETE: nenhuma policy ativa para authenticated -> feito por service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulado_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulado_respostas_admin_select"    ON public.simulado_respostas;
DROP POLICY IF EXISTS "simulado_respostas_coord_select"    ON public.simulado_respostas;
DROP POLICY IF EXISTS "simulado_respostas_student_select"  ON public.simulado_respostas;
DROP POLICY IF EXISTS "simulado_respostas_admin_delete"    ON public.simulado_respostas;

CREATE POLICY "simulado_respostas_admin_select"
ON public.simulado_respostas
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "simulado_respostas_coord_select"
ON public.simulado_respostas
FOR SELECT
TO authenticated
USING (
  public.current_project_role() = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = simulado_respostas.simulado_id
      AND s.school_id = public.current_school_id()
  )
);

CREATE POLICY "simulado_respostas_student_select"
ON public.simulado_respostas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = simulado_respostas.student_id
      AND s.profile_id = auth.uid()
  )
);

-- super_admin pode apagar para corrigir problemas operacionais
CREATE POLICY "simulado_respostas_admin_delete"
ON public.simulado_respostas
FOR DELETE
TO authenticated
USING (public.is_super_admin());
