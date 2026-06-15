-- Mostra na aba "Simulados" do aluno também os simulados FECHADOS que ele já respondeu
-- (para que o resultado de simulados encerrados — ex.: provas escaneadas importadas e
-- simulados XTRI já fechados — apareça como card "Ver resultado").
--
-- Antes: WHERE sim.status = 'published'  → simulados fechados sumiam da lista após encerrar.
-- Agora: published OR (closed AND já respondeu).
--   - Submissão continua bloqueada para 'closed' (a Edge Function submit-simulado valida status).
--   - Quem NÃO respondeu um simulado fechado não o vê (evita "fantasma" para não-participantes).
--   - 'draft' nunca aparece.

CREATE OR REPLACE FUNCTION public.get_student_simulados_pendentes()
 RETURNS TABLE(id uuid, title text, school_id uuid, turmas text[], published_at timestamp with time zone, ja_respondeu boolean, submitted_at timestamp with time zone, caderno_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT s.id AS student_id, s.school_id, s.turma
    FROM public.students s
    WHERE s.profile_id = auth.uid()
    ORDER BY s.id
    LIMIT 1
  )
  SELECT
    sim.id,
    sim.title,
    sim.school_id,
    sim.turmas,
    sim.published_at,
    (resp.id IS NOT NULL) AS ja_respondeu,
    resp.submitted_at,
    sim.caderno_url
  FROM public.simulados sim
  CROSS JOIN me
  LEFT JOIN public.simulado_respostas resp
         ON resp.simulado_id = sim.id
        AND resp.student_id  = me.student_id
  WHERE (
      sim.status = 'published'
      OR (sim.status = 'closed' AND resp.id IS NOT NULL)
    )
    AND sim.school_id  = me.school_id
    AND (
      cardinality(sim.turmas) = 0
      OR me.turma = ANY(sim.turmas)
    )
  ORDER BY sim.published_at DESC NULLS LAST;
$function$;
