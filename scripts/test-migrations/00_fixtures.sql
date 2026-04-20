-- Fixtures minimas para testar migrations 015 e 016 em isolamento.
-- Cria schema clean + tabelas e helpers que 015/016 dependem (schools,
-- students, project_users, helpers de 008_).
--
-- Uso: docker exec -i supabase_db_home psql -U postgres -d postgres < 00_fixtures.sql

\set ON_ERROR_STOP on

BEGIN;

-- Clean slate para o schema de teste (nao mexe em auth.* / storage.*).
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL  ON SCHEMA public TO service_role;

-- Default privileges: qualquer tabela criada em public a seguir ja vai ter
-- SELECT/INSERT/UPDATE/DELETE para authenticated e anon (RLS filtra o resto).
-- Necessario porque DROP SCHEMA CASCADE apaga os defaults originais do Supabase.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO service_role;

-- ---------------------------------------------------------------------------
-- Fixtures em auth.users para suportar FKs em simulados.created_by,
-- project_users.auth_uid, students.profile_id. Supabase start ja cria o
-- schema auth; aqui so inserimos os UUIDs que usamos nos testes.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, is_sso_user, is_anonymous
) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'super@test.local',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '', false, false),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'coord@test.local',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '', false, false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aluno-a@test.local',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '', false, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aluno-b@test.local',
   '', now(), '{}'::jsonb, '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '', false, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tabelas base (mock minimo — em prod vem de migrations fora deste folder)
-- ---------------------------------------------------------------------------
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid,
  school_id uuid NOT NULL REFERENCES public.schools(id),
  turma text,
  matricula text,
  name text
);
CREATE INDEX idx_students_profile_id ON public.students(profile_id);

CREATE TABLE public.project_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid uuid,
  email text NOT NULL,
  name text,
  school_id uuid REFERENCES public.schools(id),
  role text NOT NULL CHECK (role IN ('super_admin', 'coordinator', 'viewer', 'student')),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  allowed_series text[]
);
CREATE INDEX idx_project_users_auth_uid ON public.project_users(auth_uid);

-- ---------------------------------------------------------------------------
-- Helpers replicados de 008_create_mentor_intelligence_tables.sql
-- (necessarios para 016_simulados_rls.sql)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_project_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pu.role
  FROM public.project_users pu
  WHERE pu.auth_uid = auth.uid()
    AND pu.is_active = true
  ORDER BY CASE WHEN pu.role = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pu.school_id
  FROM public.project_users pu
  WHERE pu.auth_uid = auth.uid()
    AND pu.is_active = true
  ORDER BY CASE WHEN pu.role = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.current_project_role() = 'super_admin', false);
$$;

GRANT EXECUTE ON FUNCTION public.current_project_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMIT;

\echo 'Fixtures aplicadas com sucesso.'
