-- Migration 031: prefixo `extensions.` em gen_salt/crypt de add_project_user
--
-- Bug reportado em 2026-05-01 (Saniele Sodre, Dom Bosco):
--   "function gen_salt(unknown) does not exist" ao criar coordenador com
--   senha temporaria.
--
-- Causa raiz:
--   pgcrypto esta instalado no schema `extensions` (nao em `public`):
--     SELECT extnamespace::regnamespace FROM pg_extension WHERE extname='pgcrypto';
--     -> extensions
--   Mas add_project_user foi declarada com SET search_path TO 'public', entao
--   `gen_salt('bf')` e `crypt(...)` chamados sem prefixo nao sao encontrados.
--
-- Fix (Karpathy §3 cirurgico):
--   Recria a funcao identica a V1 (validada na migration 030) trocando apenas:
--     gen_salt('bf')           -> extensions.gen_salt('bf')
--     crypt(p_password, ...)   -> extensions.crypt(p_password, ...)
--   3 ocorrencias no total: 1 UPDATE da senha + 2 INSERTs em auth.users.
--
-- Defensivo: mantem SECURITY DEFINER, search_path=public (mexe so nas chamadas
-- crypto), assinatura identica (texto, uuid, text, text, text[], text).

CREATE OR REPLACE FUNCTION public.add_project_user(
  p_email text,
  p_school_id uuid DEFAULT NULL::uuid,
  p_name text DEFAULT NULL::text,
  p_role text DEFAULT 'coordinator'::text,
  p_allowed_series text[] DEFAULT ARRAY['3º Ano'::text],
  p_password text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid uuid;
  v_existing RECORD;
  v_created_auth boolean := false;
  v_invite_code TEXT := NULL;
BEGIN
  IF NOT is_project_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Apenas super_admin pode adicionar usuarios');
  END IF;

  IF p_school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schools WHERE id = p_school_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Escola nao encontrada');
  END IF;

  SELECT * INTO v_existing FROM project_users WHERE email = p_email;
  IF FOUND THEN
    -- Gerar novo invite_code se reativando sem senha
    IF p_password IS NULL AND v_existing.auth_uid IS NULL THEN
      v_invite_code := generate_invite_code();
    END IF;

    -- Se tem senha nova E o user ja tem auth_uid, atualizar a senha
    IF p_password IS NOT NULL AND length(p_password) >= 6 AND v_existing.auth_uid IS NOT NULL THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          updated_at = now()
      WHERE id = v_existing.auth_uid;
    END IF;

    -- Se tem senha nova mas NAO tem auth_uid, criar conta auth
    IF p_password IS NOT NULL AND length(p_password) >= 6 AND v_existing.auth_uid IS NULL THEN
      v_auth_uid := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change, email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token,
        is_sso_user, is_anonymous
      ) VALUES (
        v_auth_uid, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', p_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', COALESCE(p_name, '')),
        now(), now(), '', '', '', '', '', '', '', '', false, false
      );
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_auth_uid, v_auth_uid,
        jsonb_build_object('sub', v_auth_uid::text, 'email', p_email, 'email_verified', true),
        'email', v_auth_uid::text, now(), now(), now()
      );
    END IF;

    UPDATE project_users SET
      school_id = COALESCE(p_school_id, school_id),
      role = p_role,
      name = COALESCE(p_name, name),
      allowed_series = p_allowed_series,
      is_active = true,
      auth_uid = COALESCE(v_auth_uid, auth_uid),
      invite_code = COALESCE(v_invite_code, invite_code),
      invite_used_at = CASE WHEN v_invite_code IS NOT NULL THEN NULL ELSE invite_used_at END,
      must_change_password = CASE WHEN p_password IS NOT NULL THEN true ELSE must_change_password END
    WHERE email = p_email;

    RETURN jsonb_build_object(
      'success', true,
      'message', CASE WHEN p_password IS NOT NULL THEN 'Usuario atualizado com nova senha.' ELSE 'Usuario atualizado' END,
      'action', 'updated',
      'invite_code', v_invite_code
    );
  END IF;

  -- Novo usuario: buscar auth_uid se ja existe
  SELECT id INTO v_auth_uid FROM auth.users WHERE email = p_email;

  -- Criar conta auth se nao existe e tem senha
  IF v_auth_uid IS NULL AND p_password IS NOT NULL AND length(p_password) >= 6 THEN
    v_auth_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      is_sso_user, is_anonymous
    ) VALUES (
      v_auth_uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', COALESCE(p_name, '')),
      now(), now(), '', '', '', '', '', '', '', '', false, false
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_auth_uid, v_auth_uid,
      jsonb_build_object('sub', v_auth_uid::text, 'email', p_email, 'email_verified', true),
      'email', v_auth_uid::text, now(), now(), now()
    );
    v_created_auth := true;
  END IF;

  -- Gerar invite_code se não tem senha e não tem auth
  IF p_password IS NULL AND v_auth_uid IS NULL THEN
    v_invite_code := generate_invite_code();
  END IF;

  INSERT INTO project_users (auth_uid, email, name, school_id, role, allowed_series, invited_by, must_change_password, invite_code)
  VALUES (
    v_auth_uid, p_email, p_name, p_school_id, p_role, p_allowed_series,
    auth.uid(),
    CASE WHEN v_created_auth THEN true ELSE false END,
    v_invite_code
  );

  IF v_created_auth THEN
    RETURN jsonb_build_object('success', true, 'message', 'Usuario criado com senha temporaria.', 'action', 'created_with_password');
  ELSIF v_auth_uid IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Usuario adicionado ao projeto', 'action', 'added');
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'Convite criado com código.', 'action', 'invited', 'invite_code', v_invite_code);
  END IF;
END;
$function$;
