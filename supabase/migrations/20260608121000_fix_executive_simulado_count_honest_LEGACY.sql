-- ⚠️ ALVO: banco LEGACY (xtri-gabaritos, ref axtmozyrnsrhqrnktshz). NÃO aplicar no PRIMARY:
-- esta view usa `student_answers` e `list_downloads`, que só existem no LEGACY.
--
-- Corrige a contagem de "fizeram simulado" da Visão Executiva.
-- Antes: simulado_students fazia JOIN student_answers.student_number = students.matricula
-- (match de texto), descartando quem teve a folha escaneada com matrícula divergente do
-- cadastro. Subcontava muita gente (ex.: PHYSICS 180→125, FACEX 63→42, NÚCLEO 97→93).
-- Agora: conta distintos por student_number, atribuído pela escola da PRÓPRIA folha
-- (sa.school_id) — toda folha escaneada = 1 aluno que fez o simulado.
--
-- O painel admin (dashboard-home.tsx) lê esta coluna `alunos_com_simulado` como o
-- "alcance" (quem fez a prova), separado de "atendido" (= cronograma, lido do PRIMARY).

create or replace view public.executive_school_activity as
with schools_base as (
  select schools.id, schools.name, schools.slug, schools.state
  from schools
),
students_by_school as (
  select students.school_id, count(*)::integer as alunos_base
  from students group by students.school_id
),
simulado_students as (
  select sa.school_id,
         count(distinct sa.student_number)::integer as alunos_com_simulado
  from student_answers sa
  where sa.student_number is not null and sa.student_number <> ''
  group by sa.school_id
),
cronograma_students as (
  select st_1.school_id, count(distinct st_1.matricula)::integer as alunos_com_cronograma
  from students st_1
  join cronogramas c on c.aluno_id = st_1.matricula or c.aluno_id = st_1.id::text
  group by st_1.school_id
),
cronogramas_by_school as (
  select st_1.school_id, count(distinct c.id)::integer as cronogramas_gerados
  from students st_1
  join cronogramas c on c.aluno_id = st_1.matricula or c.aluno_id = st_1.id::text
  group by st_1.school_id
),
blocks_by_school as (
  select st_1.school_id, count(b.id)::integer as blocos_criados
  from students st_1
  join cronogramas c on c.aluno_id = st_1.matricula or c.aluno_id = st_1.id::text
  join blocos_cronograma b on b.cronograma_id = c.id
  group by st_1.school_id
),
downloads_by_school as (
  select list_downloads.school_id,
         count(*)::integer as downloads_listas,
         count(distinct list_downloads.student_id)::integer as alunos_com_download
  from list_downloads group by list_downloads.school_id
)
select
  sb.id as school_id,
  sb.name as escola,
  sb.slug,
  sb.state,
  coalesce(st.alunos_base, 0) as alunos_base,
  coalesce(ss.alunos_com_simulado, 0) as alunos_com_simulado,
  coalesce(cs.alunos_com_cronograma, 0) as alunos_com_cronograma,
  greatest(coalesce(ss.alunos_com_simulado, 0), coalesce(cs.alunos_com_cronograma, 0)) as alunos_atendidos,
  coalesce(cg.cronogramas_gerados, 0) as cronogramas_gerados,
  coalesce(bb.blocos_criados, 0) as blocos_criados,
  coalesce(db.downloads_listas, 0) as downloads_listas,
  coalesce(db.alunos_com_download, 0) as alunos_com_download,
  (coalesce(ss.alunos_com_simulado, 0) > 0
    or coalesce(cs.alunos_com_cronograma, 0) > 0
    or coalesce(db.downloads_listas, 0) > 0) as escola_ativa
from schools_base sb
left join students_by_school st on st.school_id = sb.id
left join simulado_students ss on ss.school_id = sb.id
left join cronograma_students cs on cs.school_id = sb.id
left join cronogramas_by_school cg on cg.school_id = sb.id
left join blocks_by_school bb on bb.school_id = sb.id
left join downloads_by_school db on db.school_id = sb.id;
