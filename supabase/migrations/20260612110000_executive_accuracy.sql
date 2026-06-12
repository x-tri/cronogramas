-- Fase 2 do painel executivo: acurácia (2026-06-12).
--
-- executive_blocos_por_aluno: contagem de blocos por aluno para o dashboard
-- exibir MEDIANA e distribuição em vez da média (média é distorcida por
-- poucos alunos hiperativos). Segue o padrão das views executive_*
-- existentes (owner), consumida só pelo dashboard admin.
--
-- Obs.: executive_storage_metrics JÁ existia no PRIMARY — o problema era o
-- dashboard só consultar a do LEGACY (corrigido no código, sem DDL).

CREATE VIEW executive_blocos_por_aluno AS
SELECT
  c.aluno_id,
  count(b.id)::integer AS blocos
FROM cronogramas c
JOIN blocos_cronograma b ON b.cronograma_id = c.id
GROUP BY c.aluno_id;
