
-- Step 1: Allow 'student' role in project_users
ALTER TABLE project_users DROP CONSTRAINT project_users_role_check;
ALTER TABLE project_users ADD CONSTRAINT project_users_role_check 
  CHECK (role = ANY (ARRAY['super_admin', 'coordinator', 'viewer', 'student']));

-- Step 2: Create auth users and project_users for all students
DO $$
DECLARE
  r RECORD;
  v_uid uuid;
  v_email text;
BEGIN
  FOR r IN 
    SELECT s.id, s.matricula, s.name, s.school_id, s.profile_id
    FROM students s
    WHERE s.matricula IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = s.profile_id
      )
  LOOP
    v_email := r.matricula || '@aluno.xtri.com';
    
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
    
    IF v_uid IS NULL THEN
      v_uid := COALESCE(r.profile_id, gen_random_uuid());
      
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
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_email,
        crypt('123456', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', COALESCE(r.name, '')),
        now(), now(),
        '', '', '', '', '', '', '', '',
        false, false
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_uid, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', v_uid::text,
        now(), now(), now()
      );
    END IF;

    UPDATE students SET profile_id = v_uid WHERE id = r.id;

    INSERT INTO project_users (auth_uid, email, name, school_id, role, must_change_password, allowed_series)
    VALUES (v_uid, v_email, r.name, r.school_id, 'student', true, ARRAY['3º Ano'])
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
