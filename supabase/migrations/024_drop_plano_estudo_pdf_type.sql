-- Migration 024: sepulta tipo legacy 'plano_estudo' do pdf_history
--
-- Contexto:
--   O tipo 'plano_estudo' existia desde a migration 012_expand_pdf_history_types
--   mas nunca foi gerado por nenhum codigo do app (nem admin nem aluno).
--   Confirmado em 2026-04-25:
--     - Zero geradores no codigo (busca exaustiva *.ts/tsx/js/sql/json/yaml/md)
--     - Zero linhas em producao (REST: content-range: */0)
--   Os tipos vivos sao: cronograma, relatorio, caderno_questoes.
--
-- Defesa:
--   Aborta se houver qualquer linha com 'plano_estudo' (cenario nao esperado;
--   se acontecer, investigar antes de sepultar para nao perder dados).

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.pdf_history
    WHERE tipo = 'plano_estudo';

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 024 abortada: existem % linhas com tipo=plano_estudo. Investigar antes de sepultar.',
      v_count;
  END IF;
END $$;

ALTER TABLE public.pdf_history
  DROP CONSTRAINT IF EXISTS pdf_history_tipo_check;

ALTER TABLE public.pdf_history
  ADD CONSTRAINT pdf_history_tipo_check
  CHECK (tipo IN ('cronograma', 'relatorio', 'caderno_questoes'));

COMMENT ON CONSTRAINT pdf_history_tipo_check ON public.pdf_history IS
  'Tipos vivos: cronograma (semanal), relatorio (pos-simulado), caderno_questoes (do simulado). plano_estudo foi sepultado em 024.';
