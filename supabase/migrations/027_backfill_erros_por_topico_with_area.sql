-- Migration 027: backfill de simulado_respostas.erros_por_topico para formato { area, n }
--
-- Contexto:
--   Ate o commit do dia 2026-04-26, submit-simulado.ts agregava erros_por_topico
--   no formato Record<string, number>. Bug: 28% dos topicos nao tinham prefixo
--   "Materia - " e o classificador heuristico (areaDoTopico) nao conseguia
--   inferir a area, fazendo 0 erros aparecerem em LC/CH/MT no drawer individual
--   do aluno e no card "Topico mais errado por area" do ranking.
--
--   Fix da causa raiz (mesmo PR): novo formato Record<string, { area, n }>
--   onde area vem autoritativa de simulado_itens.area.
--
-- Acao:
--   Para cada chave (topico) em erros_por_topico que esta no formato antigo
--   (valor numerico), pega a area autoritativa via JOIN com simulado_itens
--   (mesmo simulado_id + mesmo topico) e reformata para { area, n }.
--
--   Defensivo: chaves cujo topico NAO existe em simulado_itens (caso edge —
--   topico foi alterado depois do submit, ou registro foi deletado) sao
--   preservadas no formato legacy. Consumers (ranking-aggregations.ts)
--   detectam ambos formatos via unwrapErroValor.
--
-- Idempotente: rerodar e safe — chaves ja em novo formato (valor object) sao
--   mantidas como estao no CASE ELSE.

DO $$
DECLARE
  v_respostas_total int;
  v_respostas_com_legacy int;
  v_respostas_atualizadas int;
BEGIN
  SELECT COUNT(*) INTO v_respostas_total FROM public.simulado_respostas;

  SELECT COUNT(*) INTO v_respostas_com_legacy
  FROM public.simulado_respostas sr
  WHERE EXISTS (
    SELECT 1 FROM jsonb_each(sr.erros_por_topico) AS e(k, v)
    WHERE jsonb_typeof(v) = 'number'
  );

  WITH chaves AS (
    SELECT
      sr.id AS resposta_id,
      sr.simulado_id,
      e.k AS topico,
      e.v AS valor_antigo
    FROM public.simulado_respostas sr
    CROSS JOIN LATERAL jsonb_each(sr.erros_por_topico) AS e(k, v)
    WHERE EXISTS (
      SELECT 1 FROM jsonb_each(sr.erros_por_topico) AS e2(k2, v2)
      WHERE jsonb_typeof(v2) = 'number'
    )
  ),
  reformatado AS (
    SELECT
      c.resposta_id,
      jsonb_object_agg(
        c.topico,
        CASE
          WHEN si.area IS NOT NULL AND jsonb_typeof(c.valor_antigo) = 'number' THEN
            jsonb_build_object('area', si.area, 'n', (c.valor_antigo)::int)
          ELSE
            c.valor_antigo  -- preserva formato legacy se nao houve match
        END
      ) AS novo
    FROM chaves c
    LEFT JOIN public.simulado_itens si
      ON si.simulado_id = c.simulado_id
     AND si.topico = c.topico
    GROUP BY c.resposta_id
  ),
  atualizadas AS (
    UPDATE public.simulado_respostas sr
    SET erros_por_topico = r.novo
    FROM reformatado r
    WHERE sr.id = r.resposta_id
    RETURNING sr.id
  )
  SELECT COUNT(*) INTO v_respostas_atualizadas FROM atualizadas;

  RAISE NOTICE 'Backfill 027: % respostas no total; % com algum valor legacy; % efetivamente reescritas.',
    v_respostas_total, v_respostas_com_legacy, v_respostas_atualizadas;
END $$;
