-- CRITICAL 3: Desvínculo atômico de conta Google do aluno.
--
-- Problema: handleUnlinkGoogle no admin-controle.tsx executava 3 operações
-- sequenciais sem transação (DELETE project_users, DELETE profiles,
-- UPDATE students.profile_id = null). Se a 2ª ou 3ª falhar, o vínculo
-- fica corrompido (ex.: profile removido mas student.profile_id apontando
-- para UUID órfão).
--
-- Solução: função SECURITY DEFINER que faz tudo em uma única transação
-- implícita. Segue o padrão de 005_create_get_school_names_rpc.sql.

CREATE OR REPLACE FUNCTION public.unlink_google_student(p_matricula text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Resolve o profile_id atual do aluno pela matrícula
  SELECT profile_id
    INTO v_profile_id
    FROM public.students
   WHERE matricula = p_matricula;

  IF v_profile_id IS NULL THEN
    -- Nada a fazer; não é erro (idempotente).
    RETURN;
  END IF;

  -- Os 3 passos abaixo ocorrem na mesma transação implícita do PL/pgSQL:
  -- se qualquer um falhar, tudo é revertido.

  DELETE FROM public.project_users
   WHERE auth_uid = v_profile_id
     AND role = 'student';

  -- Remove apenas se o profile não for a conta "técnica" @aluno.xtri.com
  DELETE FROM public.profiles
   WHERE id = v_profile_id
     AND (email IS NULL OR email NOT LIKE '%@aluno.xtri.com');

  UPDATE public.students
     SET profile_id = NULL
   WHERE matricula = p_matricula;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_google_student(text) TO authenticated;
