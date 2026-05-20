create or replace view public.executive_school_activity as
with schools_base as (
  select id, name, slug, state
  from public.schools
),
students_by_school as (
  select school_id, count(*)::integer as alunos_base
  from public.students
  group by school_id
),
simulado_students as (
  select st.school_id, count(distinct st.matricula)::integer as alunos_com_simulado
  from public.students st
  join public.student_answers sa
    on sa.school_id = st.school_id
   and sa.student_number = st.matricula
  group by st.school_id
),
cronograma_students as (
  select st.school_id, count(distinct st.matricula)::integer as alunos_com_cronograma
  from public.students st
  join public.cronogramas c
    on c.aluno_id = st.matricula
    or c.aluno_id = st.id::text
  group by st.school_id
),
cronogramas_by_school as (
  select st.school_id, count(distinct c.id)::integer as cronogramas_gerados
  from public.students st
  join public.cronogramas c
    on c.aluno_id = st.matricula
    or c.aluno_id = st.id::text
  group by st.school_id
),
blocks_by_school as (
  select st.school_id, count(b.id)::integer as blocos_criados
  from public.students st
  join public.cronogramas c
    on c.aluno_id = st.matricula
    or c.aluno_id = st.id::text
  join public.blocos_cronograma b
    on b.cronograma_id = c.id
  group by st.school_id
),
downloads_by_school as (
  select school_id,
         count(*)::integer as downloads_listas,
         count(distinct student_id)::integer as alunos_com_download
  from public.list_downloads
  group by school_id
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
  (
    coalesce(ss.alunos_com_simulado, 0) > 0
    or coalesce(cs.alunos_com_cronograma, 0) > 0
    or coalesce(db.downloads_listas, 0) > 0
  ) as escola_ativa
from schools_base sb
left join students_by_school st on st.school_id = sb.id
left join simulado_students ss on ss.school_id = sb.id
left join cronograma_students cs on cs.school_id = sb.id
left join cronogramas_by_school cg on cg.school_id = sb.id
left join blocks_by_school bb on bb.school_id = sb.id
left join downloads_by_school db on db.school_id = sb.id;

create or replace view public.executive_operation_metrics as
select
  count(*) filter (where escola_ativa)::integer as escolas_ativas,
  sum(alunos_base) filter (where escola_ativa)::integer as alunos_base_escolas_ativas,
  sum(alunos_atendidos)::integer as alunos_atendidos,
  sum(alunos_com_simulado)::integer as alunos_com_simulado,
  sum(alunos_com_cronograma)::integer as alunos_com_cronograma,
  sum(cronogramas_gerados)::integer as cronogramas_gerados,
  sum(blocos_criados)::integer as blocos_criados,
  round(sum(blocos_criados)::numeric / nullif(sum(alunos_com_cronograma), 0), 2) as blocos_por_aluno_com_cronograma,
  sum(downloads_listas)::integer as downloads_listas
from public.executive_school_activity;

create or replace view public.executive_storage_metrics as
select
  count(*)::integer as storage_objects,
  coalesce(sum((metadata->>'size')::bigint), 0)::bigint as storage_bytes
from storage.objects;

comment on view public.executive_school_activity is
  'Auditoria executiva por escola. Separa alunos com simulado, alunos com cronograma e alunos atendidos para evitar subcontar escolas como Marista Natal.';

comment on view public.executive_operation_metrics is
  'Métricas executivas consolidadas calculadas a partir de executive_school_activity.';

comment on view public.executive_storage_metrics is
  'Métrica executiva de armazenamento total em Supabase Storage.';
