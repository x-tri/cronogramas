-- Migration 028: corrige is_my_cronograma para aceitar aluno_id em matricula OU UUID
--
-- Bug:
--   blocos_cronograma tem policy student_view_own_blocos que delega a
--   is_my_cronograma(cronograma_id). Essa funcao so comparava
--   aluno_id = students.id::text (UUID), nao incluia
--   aluno_id = students.matricula.
--
--   Mas cronogramas criados pelo coord via fluxo manual sao salvos com
--   aluno_id = matricula (porque student-search.tsx linha 70 atribui
--   id: supabaseStudent.matricula no objeto Aluno passado pra createCronograma).
--
--   Resultado: aluno conseguia listar o cronograma (cronogramas tem policy
--   permissiva) mas nao conseguia ler os blocos — tela ficava vazia.
--
-- Confirmado em prod 2026-04-27:
--   - 74 cronogramas em matricula (afetados, novos manuais)
--   - 77 cronogramas em UUID (legacy, ainda funcionando)
--
-- Fix: paridade com is_my_aluno_id (que ja cobria ambos formatos).

CREATE OR REPLACE FUNCTION public.is_my_cronograma(p_cronograma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cronogramas c
    JOIN public.students s ON s.profile_id = auth.uid()
    WHERE c.id = p_cronograma_id
      AND (c.aluno_id = s.id::text OR c.aluno_id = s.matricula)
  );
$$;

COMMENT ON FUNCTION public.is_my_cronograma(uuid) IS
  'Retorna true se o cronograma pertence ao aluno autenticado. Aceita aluno_id como UUID (s.id) ou matricula (s.matricula) — paridade com is_my_aluno_id.';
