-- scripts/eval/02_validate_all_projetos.sql
--
-- Valida consistência (sys == calc) para TODOS os students de TODOS os
-- projetos que se qualificam como "ENEM 180 moderno". Critério:
--
--   key_len = 180  AND  blankAnswers IS NOT NULL
--             AND  (sys_correct + sys_wrong + sys_blank) = key_len
--
-- O último predicado descarta automaticamente os projetos com regras
-- peculiares (MED conta só Dia 1 quando fezDia2=false, simulados de 45/90
-- questões, JSONB legado sem blankAnswers).
--
-- DB: SIMULADO (link com `npx supabase link --project-ref axtmozyrnsrhqrnktshz`)
--
-- Saída: 1 linha com {status, total_projetos, alunos_validados, divergentes,
-- divergent_projetos, sample}. status = PASS se divergentes=0, FAIL caso
-- contrário. sample contém até 10 divergências para diagnóstico.

WITH all_students AS (
  SELECT p.id AS project_id, p.nome AS project_name, p.answer_key,
         array_length(p.answer_key, 1) AS key_len, s.sd
  FROM projetos p, jsonb_array_elements(p.students) AS s(sd)
  WHERE jsonb_array_length(p.students) > 0
),
computed AS (
  SELECT a.project_id, a.project_name, a.key_len,
         a.sd->>'studentNumber' AS matricula,
         (a.sd->>'correctAnswers')::int AS sys_c,
         (a.sd->>'wrongAnswers')::int   AS sys_w,
         (a.sd->>'blankAnswers')::int   AS sys_b,
         SUM(CASE WHEN a.sd->'answers'->>(i-1) = a.answer_key[i] THEN 1 ELSE 0 END) + 1 AS c_c,  -- ADVERSARIAL: +1 forca divergence
         SUM(CASE WHEN a.sd->'answers'->>(i-1) IN ('A','B','C','D','E')
                   AND a.sd->'answers'->>(i-1) <> a.answer_key[i] THEN 1 ELSE 0 END) AS c_w,
         SUM(CASE WHEN a.sd->'answers'->>(i-1) IS NULL
                   OR  a.sd->'answers'->>(i-1) NOT IN ('A','B','C','D','E') THEN 1 ELSE 0 END) AS c_b
  FROM all_students a, generate_series(1, a.key_len) AS i
  GROUP BY a.project_id, a.project_name, a.key_len, matricula, sys_c, sys_w, sys_b
),
moderno AS (
  SELECT * FROM computed
  WHERE key_len = 180
    AND sys_b IS NOT NULL
    AND (sys_c + sys_w + sys_b) = key_len
),
divergent AS (
  SELECT * FROM moderno
  WHERE sys_c <> c_c OR sys_w <> c_w OR sys_b <> c_b
)
SELECT
  CASE WHEN (SELECT count(*) FROM divergent) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  (SELECT count(DISTINCT project_id) FROM moderno)   AS total_projetos,
  (SELECT count(*) FROM moderno)                     AS alunos_validados,
  (SELECT count(*) FROM divergent)                   AS divergentes,
  (SELECT count(DISTINCT project_id) FROM divergent) AS divergent_projetos,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
        'project', project_name,
        'matricula', matricula,
        'sys', jsonb_build_object('c', sys_c, 'w', sys_w, 'b', sys_b),
        'calc', jsonb_build_object('c', c_c, 'w', c_w, 'b', c_b)
      ))
     FROM (SELECT * FROM divergent LIMIT 10) d
    ), '[]'::jsonb
  ) AS sample;
