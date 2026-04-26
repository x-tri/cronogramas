-- Migration 026: backfill de pdf_history.turma a partir de students.turma
--
-- Contexto:
--   Os geradores de PDF tipo 'caderno_questoes' e 'relatorio'
--   (relatorio-cirurgico.tsx + simulado-analyzer.tsx) chamavam uploadPdf()
--   sem passar 'turma', resultando em pdf_history.turma=NULL para esses tipos.
--   Confirmado em 2026-04-26 via auditoria: 23 PDFs sem turma na Marista
--   (16 caderno_questoes + 7 relatorio); cronograma nao foi afetado pois vem
--   de share-dropdown.tsx que passa turma corretamente.
--
--   O fix do gerador entrou junto com esta migration (mesmo PR).
--
-- Acao:
--   Para cada pdf_history com turma=NULL, puxa students.turma via matricula.
--   Defesa: WHERE st.turma IS NOT NULL evita escrever NULL onde ja era NULL,
--   mantendo idempotencia (rerodar a migration nao bagunca).
--
-- Tradeoff aceito:
--   Se aluno mudou de turma desde a geracao do PDF, o backfill grava a turma
--   ATUAL. Confirmado com PO em 2026-04-26 que nao houve mudancas de turma
--   no periodo afetado, entao o backfill reflete a realidade historica.

DO $$
DECLARE
  v_updated int;
  v_remaining_null int;
BEGIN
  WITH updated AS (
    UPDATE public.pdf_history ph
    SET turma = st.turma
    FROM public.students st
    WHERE ph.matricula = st.matricula
      AND ph.turma IS NULL
      AND st.turma IS NOT NULL
    RETURNING ph.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;

  SELECT COUNT(*) INTO v_remaining_null
  FROM public.pdf_history
  WHERE turma IS NULL;

  RAISE NOTICE 'Backfill 026: % linhas atualizadas; % ainda com turma=NULL (matricula sem match em students ou student.turma=NULL).',
    v_updated, v_remaining_null;
END $$;
