-- Visão Executiva (PRIMARY / cronograma-de-estudos): corrige a definição de "atendido".
--
-- Contexto: a view 008 versionada usa o esquema do banco LEGACY (xtri-gabaritos):
-- conta simulado via `student_answers` e downloads via `list_downloads`. O PRIMARY
-- nunca teve essa definição versionada (drift citado no AGENTS.md como "Migration A"
-- inexistente). Esta migration estabelece a definição canônica do PRIMARY.
--
-- Mudança de semântica (confirmada pelo usuário, validada no Marista Natal = 106):
--   atendido = aluno com CRONOGRAMA de estudo gerado.
--   Antes: alunos_atendidos = GREATEST(alunos_com_simulado, alunos_com_cronograma),
--   o que rotulava participação em simulado como atendimento.
--
-- simulado (in-app) e downloads continuam como colunas separadas, não como atendimento.
-- security_invoker permanece false (agregado completo p/ super_admin).

create or replace view public.executive_school_activity as
with schools_base as (
  select id, name, slug
  from public.schools
  where name !~~* 'teste%'::text
),
students_by_school as (
  select students.school_id, count(*)::integer as alunos_base
  from public.students
  group by students.school_id
),
simulado_students as (
  select s.school_id, count(distinct sr.student_id)::integer as alunos_com_simulado
  from public.simulado_respostas sr
  join public.simulados s on s.id = sr.simulado_id
  group by s.school_id
),
cronograma_students as (
  select st.school_id, count(distinct st.id)::integer as alunos_com_cronograma
  from public.students st
  join public.cronogramas c on c.aluno_id = st.matricula or c.aluno_id = st.id::text
  group by st.school_id
),
cronogramas_by_school as (
  select st.school_id, count(distinct c.id)::integer as cronogramas_gerados
  from public.students st
  join public.cronogramas c on c.aluno_id = st.matricula or c.aluno_id = st.id::text
  group by st.school_id
),
blocks_by_school as (
  select st.school_id, count(distinct b.id)::integer as blocos_criados
  from public.students st
  join public.cronogramas c on c.aluno_id = st.matricula or c.aluno_id = st.id::text
  join public.blocos_cronograma b on b.cronograma_id = c.id
  group by st.school_id
),
downloads_by_school as (
  select pdf_download_log.school_id,
         count(*)::integer as downloads_listas,
         count(distinct pdf_download_log.student_id)::integer as alunos_com_download
  from public.pdf_download_log
  group by pdf_download_log.school_id
)
select
  sb.id as school_id,
  sb.name as escola,
  sb.slug,
  coalesce(st.alunos_base, 0) as alunos_base,
  coalesce(ss.alunos_com_simulado, 0) as alunos_com_simulado,
  coalesce(cs.alunos_com_cronograma, 0) as alunos_com_cronograma,
  coalesce(cs.alunos_com_cronograma, 0) as alunos_atendidos,
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

comment on view public.executive_school_activity is
  'Auditoria executiva por escola (PRIMARY). atendido = aluno com cronograma gerado. Simulado (in-app) e downloads ficam como metricas separadas.';
