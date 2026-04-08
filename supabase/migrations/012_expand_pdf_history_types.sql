-- Permite registrar todos os PDFs pedagógicos gerados pelo app.
-- Antes o histórico aceitava só cronograma/plano_estudo e rejeitava
-- relatório de desempenho e caderno de questões.

ALTER TABLE IF EXISTS public.pdf_history
  DROP CONSTRAINT IF EXISTS pdf_history_tipo_check;

ALTER TABLE IF EXISTS public.pdf_history
  ADD CONSTRAINT pdf_history_tipo_check
  CHECK (
    tipo IN (
      'cronograma',
      'plano_estudo',
      'relatorio',
      'caderno_questoes'
    )
  );
