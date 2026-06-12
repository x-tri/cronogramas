-- Fase 1 do painel de engajamento de mentores (2026-06-12).
--
-- 1. Autoria nas tabelas de produção: created_by com DEFAULT auth.uid() —
--    o banco preenche na inserção autenticada, sem mudança no código de
--    escrita. Linhas antigas ficam NULL (atribuição via audit_log).
-- 2. View mentor_engagement: agrega o audit_log por mentor (login,
--    generate_pdf com aluno no metadata, planos de mentoria).
--    security_invoker: o RLS de audit_log/project_users vale para quem
--    consulta — diferente das views executive_* (owner), porque esta expõe
--    comportamento por pessoa.
--
-- Gap conhecido (fora desta fase): create_cronograma não é auditado hoje,
-- então "cronogramas gerados" não entra na view — generate_pdf é o proxy.

-- pdf_history.created_by já existia (nunca preenchida, 0/91) — só ganha o default
ALTER TABLE pdf_history ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE caderno_questoes ADD COLUMN created_by uuid DEFAULT auth.uid();

CREATE VIEW mentor_engagement
WITH (security_invoker = true) AS
SELECT
  pu.email,
  pu.name,
  pu.school_id,
  s.name AS school_name,
  pu.role,
  (SELECT max(a.created_at) FROM audit_log a
    WHERE a.user_email = pu.email AND a.action = 'login') AS last_login_at,
  (SELECT count(*) FROM audit_log a
    WHERE a.user_email = pu.email AND a.action = 'login'
      AND a.created_at > now() - interval '7 days')::integer AS logins_7d,
  (SELECT count(*) FROM audit_log a
    WHERE a.user_email = pu.email AND a.action = 'generate_pdf'
      AND a.created_at > now() - interval '30 days')::integer AS pdfs_30d,
  (SELECT count(DISTINCT a.metadata->>'aluno') FROM audit_log a
    WHERE a.user_email = pu.email AND a.action = 'generate_pdf'
      AND a.created_at > now() - interval '30 days')::integer AS alunos_30d,
  (SELECT count(*) FROM audit_log a
    WHERE a.user_email = pu.email
      AND a.action IN ('create_mentor_plan', 'send_mentor_plan')
      AND a.created_at > now() - interval '30 days')::integer AS planos_30d
FROM project_users pu
LEFT JOIN schools s ON s.id = pu.school_id
WHERE pu.is_active AND pu.role IN ('coordinator', 'super_admin');
