
-- Helper: get the student id for the current logged-in user
CREATE OR REPLACE FUNCTION public.get_my_student_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- Helper: check if a cronograma belongs to the current student
CREATE OR REPLACE FUNCTION public.is_my_cronograma(p_cronograma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = p_cronograma_id
      AND c.aluno_id = (SELECT s.id::text FROM public.students s WHERE s.profile_id = auth.uid() LIMIT 1)
  );
$$;

-- Helper: check if a cronograma aluno_id matches the current student
CREATE OR REPLACE FUNCTION public.is_my_aluno_id(p_aluno_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid()
      AND (s.id::text = p_aluno_id OR s.matricula = p_aluno_id)
  );
$$;

-- Students can view their own student record
CREATE POLICY "student_view_self"
ON public.students
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Students can view their own cronogramas
CREATE POLICY "student_view_own_cronogramas"
ON public.cronogramas
FOR SELECT
TO authenticated
USING (public.is_my_aluno_id(aluno_id));

-- Students can view their own blocos
CREATE POLICY "student_view_own_blocos"
ON public.blocos_cronograma
FOR SELECT
TO authenticated
USING (public.is_my_cronograma(cronograma_id));

-- Students can update concluido on their own blocos
CREATE POLICY "student_update_own_blocos"
ON public.blocos_cronograma
FOR UPDATE
TO authenticated
USING (public.is_my_cronograma(cronograma_id))
WITH CHECK (public.is_my_cronograma(cronograma_id));

-- Students can view mentor analysis runs for their student_key
CREATE POLICY "student_view_own_analysis"
ON public.mentor_analysis_runs
FOR SELECT
TO authenticated
USING (
  student_key IN (
    SELECT s.id::text FROM public.students s WHERE s.profile_id = auth.uid()
    UNION ALL
    SELECT s.matricula FROM public.students s WHERE s.profile_id = auth.uid() AND s.matricula IS NOT NULL
  )
);

-- Students can view mentor alerts for their student_key
CREATE POLICY "student_view_own_alerts"
ON public.mentor_alerts
FOR SELECT
TO authenticated
USING (
  student_key IN (
    SELECT s.id::text FROM public.students s WHERE s.profile_id = auth.uid()
    UNION ALL
    SELECT s.matricula FROM public.students s WHERE s.profile_id = auth.uid() AND s.matricula IS NOT NULL
  )
);

-- Students can view mentor plans for their student_key
CREATE POLICY "student_view_own_plans"
ON public.mentor_plans
FOR SELECT
TO authenticated
USING (
  student_key IN (
    SELECT s.id::text FROM public.students s WHERE s.profile_id = auth.uid()
    UNION ALL
    SELECT s.matricula FROM public.students s WHERE s.profile_id = auth.uid() AND s.matricula IS NOT NULL
  )
);

-- Students can view their own plan items (via plan)
CREATE POLICY "student_view_own_plan_items"
ON public.mentor_plan_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_plans mp
    WHERE mp.id = mentor_plan_items.mentor_plan_id
      AND mp.student_key IN (
        SELECT s.id::text FROM public.students s WHERE s.profile_id = auth.uid()
        UNION ALL
        SELECT s.matricula FROM public.students s WHERE s.profile_id = auth.uid() AND s.matricula IS NOT NULL
      )
  )
);
