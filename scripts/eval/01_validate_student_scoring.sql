-- scripts/eval/01_validate_student_scoring.sql
--
-- Recomputa acertos/erros/brancos (total + por área) a partir das respostas
-- brutas do aluno em `projetos.students[*].answers` vs `projetos.answer_key`,
-- e compara contra o que o sistema gravou (`correctAnswers`, `wrongAnswers`,
-- `blankAnswers`, `areaCorrectAnswers`). PASS sse todos os 7 valores baterem.
--
-- DB: SIMULADO (link com `npx supabase link --project-ref axtmozyrnsrhqrnktshz`)
--
-- Parâmetros (substituir antes de rodar — sed/runner script faz isso):
--   {{PROJECT_ID}}   uuid do projeto
--   {{MATRICULA}}    matrícula do aluno (e.g. 09.8835-2)
--
-- Run manual:
--   npx supabase db query --linked -f scripts/eval/01_validate_student_scoring.sql
--
-- Saída: uma linha com `status` (PASS | FAIL | NOT_FOUND) e os 7 pares
-- (sys_*, calc_*) para diagnóstico imediato.
--
-- Regras de classificação (idênticas ao sistema):
--   - resposta NULL ou fora de {A,B,C,D,E}  → BRANCO
--   - resposta = answer_key[q]              → ACERTO
--   - resposta em {A..E} e <> answer_key[q] → ERRO

WITH params AS (
  SELECT '{{PROJECT_ID}}'::uuid AS project_id,
         '{{MATRICULA}}'::text  AS matricula
),
stored AS (
  SELECT
    p.answer_key,
    (SELECT jsonb_path_query(
       p.students,
       ('$[*] ? (@.studentNumber == "' || (SELECT matricula FROM params)
        || '" || @.matricula == "' || (SELECT matricula FROM params) || '")')::jsonpath
     ) LIMIT 1) AS s
  FROM projetos p
  WHERE p.id = (SELECT project_id FROM params)
),
computed AS (
  SELECT
    SUM(CASE WHEN s.s->'answers'->>(i-1) = s.answer_key[i] THEN 1 ELSE 0 END) AS c_correct,
    SUM(CASE WHEN s.s->'answers'->>(i-1) IN ('A','B','C','D','E')
              AND s.s->'answers'->>(i-1) <> s.answer_key[i] THEN 1 ELSE 0 END) AS c_wrong,
    SUM(CASE WHEN s.s->'answers'->>(i-1) IS NULL
              OR  s.s->'answers'->>(i-1) NOT IN ('A','B','C','D','E') THEN 1 ELSE 0 END) AS c_blank,
    SUM(CASE WHEN i BETWEEN   1 AND  45 AND s.s->'answers'->>(i-1) = s.answer_key[i] THEN 1 ELSE 0 END) AS c_lc,
    SUM(CASE WHEN i BETWEEN  46 AND  90 AND s.s->'answers'->>(i-1) = s.answer_key[i] THEN 1 ELSE 0 END) AS c_ch,
    SUM(CASE WHEN i BETWEEN  91 AND 135 AND s.s->'answers'->>(i-1) = s.answer_key[i] THEN 1 ELSE 0 END) AS c_cn,
    SUM(CASE WHEN i BETWEEN 136 AND 180 AND s.s->'answers'->>(i-1) = s.answer_key[i] THEN 1 ELSE 0 END) AS c_mt
  FROM stored s, generate_series(1, 180) AS i
  WHERE s.s IS NOT NULL
)
SELECT
  CASE
    WHEN stored.s IS NULL THEN 'NOT_FOUND'
    WHEN (stored.s->>'correctAnswers')::int            = computed.c_correct
     AND (stored.s->>'wrongAnswers')::int              = computed.c_wrong
     AND (stored.s->>'blankAnswers')::int              = computed.c_blank
     AND (stored.s->'areaCorrectAnswers'->>'LC')::int  = computed.c_lc
     AND (stored.s->'areaCorrectAnswers'->>'CH')::int  = computed.c_ch
     AND (stored.s->'areaCorrectAnswers'->>'CN')::int  = computed.c_cn
     AND (stored.s->'areaCorrectAnswers'->>'MT')::int  = computed.c_mt
    THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  (stored.s->>'correctAnswers')::int           AS sys_correct, computed.c_correct AS calc_correct,
  (stored.s->>'wrongAnswers')::int             AS sys_wrong,   computed.c_wrong   AS calc_wrong,
  (stored.s->>'blankAnswers')::int             AS sys_blank,   computed.c_blank   AS calc_blank,
  (stored.s->'areaCorrectAnswers'->>'LC')::int AS sys_lc,      computed.c_lc      AS calc_lc,
  (stored.s->'areaCorrectAnswers'->>'CH')::int AS sys_ch,      computed.c_ch      AS calc_ch,
  (stored.s->'areaCorrectAnswers'->>'CN')::int AS sys_cn,      computed.c_cn      AS calc_cn,
  (stored.s->'areaCorrectAnswers'->>'MT')::int AS sys_mt,      computed.c_mt      AS calc_mt
FROM (VALUES (1)) AS anchor(x)
LEFT JOIN stored   ON TRUE
LEFT JOIN computed ON TRUE;
