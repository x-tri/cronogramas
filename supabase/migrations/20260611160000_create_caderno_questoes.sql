-- Registro de questões entregues em cadernos de questões recomendadas.
--
-- Motivação (2026-06-11): a seleção do caderno é determinística — mesmo
-- perfil TRI + mesmas habilidades críticas + mesmo acervo = mesmas questões.
-- Sem memória do que já foi entregue, cadernos sucessivos repetem questões
-- e o aluno "acerta" por reconhecimento, não por habilidade. Esta tabela é
-- a memória: a seleção despriorizará chaves já entregues (question_key usa o
-- mesmo formato do dedupe do motor: `${ano}:${posicao ?? co_item}`).
--
-- pdf_history_id é SET NULL on delete: apagar o PDF da auditoria não pode
-- apagar a memória pedagógica de que o aluno já recebeu aquelas questões.

CREATE TABLE caderno_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_history_id uuid REFERENCES pdf_history(id) ON DELETE SET NULL,
  school_id uuid,
  aluno_id text NOT NULL,
  matricula text,
  area text NOT NULL,
  habilidade integer,
  ano integer NOT NULL,
  posicao integer,
  co_item integer,
  question_key text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_caderno_questoes_aluno ON caderno_questoes (aluno_id);
CREATE INDEX idx_caderno_questoes_matricula ON caderno_questoes (matricula);
CREATE INDEX idx_caderno_questoes_school ON caderno_questoes (school_id);

ALTER TABLE caderno_questoes ENABLE ROW LEVEL SECURITY;

-- Espelha o RLS de pdf_history: coordenador escopado pela própria escola,
-- super admin tudo, service role tudo. Sem UPDATE/DELETE para coordenador —
-- o registro de entrega é histórico imutável.
CREATE POLICY coordinator_view_caderno_questoes ON caderno_questoes
  FOR SELECT TO authenticated
  USING (school_id = get_project_school_id());

CREATE POLICY coordinator_insert_caderno_questoes ON caderno_questoes
  FOR INSERT TO authenticated
  WITH CHECK ((school_id = get_project_school_id()) OR is_project_super_admin());

CREATE POLICY super_admin_all_caderno_questoes ON caderno_questoes
  FOR ALL TO authenticated
  USING (is_project_super_admin());

CREATE POLICY service_role_caderno_questoes ON caderno_questoes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
