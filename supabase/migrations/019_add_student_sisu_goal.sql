-- Migration: adicionar meta SISU do aluno em students
--
-- Decisao de produto (user):
--   - Mentoria parte de conversa pessoal — ALUNO indica seu curso meta
--   - Nao o coord que cadastra
--   - Termometro gradiente anima a progressao da nota do aluno
--     em direcao ao curso meta + cursos alcancaveis na mesma universidade/UF
--
-- Campos adicionados (todos nullable — aluno pode nao ter cadastrado ainda):
--   - sisu_curso_nome: "Medicina", "Direito", etc.
--   - sisu_universidade: "UFRN", "USP"
--   - sisu_uf: "RN", "SP"
--   - sisu_nota_corte: nota de referencia do curso (consulta enemDataSupabase)

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS sisu_curso_nome text,
  ADD COLUMN IF NOT EXISTS sisu_universidade text,
  ADD COLUMN IF NOT EXISTS sisu_uf text CHECK (
    sisu_uf IS NULL OR sisu_uf ~ '^[A-Z]{2}$'
  ),
  ADD COLUMN IF NOT EXISTS sisu_nota_corte numeric(6,2) CHECK (
    sisu_nota_corte IS NULL OR (sisu_nota_corte BETWEEN 200 AND 1000)
  ),
  ADD COLUMN IF NOT EXISTS sisu_updated_at timestamptz;

COMMENT ON COLUMN public.students.sisu_curso_nome IS
  'Nome do curso meta do aluno (ex: Medicina). Setado pelo proprio aluno.';
COMMENT ON COLUMN public.students.sisu_nota_corte IS
  'Nota de corte de referencia do curso meta (escala ENEM 200-1000).';
