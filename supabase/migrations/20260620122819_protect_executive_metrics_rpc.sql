-- Visão Executiva: expõe métricas do PRIMARY apenas via RPC com checagem de role.
--
-- As views executivas agregam dados de alunos/escolas e eram `SECURITY DEFINER`
-- com grant para `authenticated`. Isso permite que qualquer sessão autenticada
-- consulte agregados globais pelo PostgREST. As views permanecem como camada
-- interna; o dashboard passa a usar os RPCs abaixo.

revoke all on table public.executive_operation_metrics from public;
revoke all on table public.executive_operation_metrics from anon;
revoke all on table public.executive_operation_metrics from authenticated;

revoke all on table public.executive_school_activity from public;
revoke all on table public.executive_school_activity from anon;
revoke all on table public.executive_school_activity from authenticated;

revoke all on table public.executive_storage_metrics from public;
revoke all on table public.executive_storage_metrics from anon;
revoke all on table public.executive_storage_metrics from authenticated;

drop function if exists public.get_executive_operation_metrics();
drop function if exists public.get_executive_storage_metrics();
drop function if exists public.get_executive_school_activity(uuid, boolean);

create or replace function public.get_executive_operation_metrics()
returns table(
  escolas_ativas integer,
  alunos_base_escolas_ativas integer,
  alunos_atendidos integer,
  alunos_com_simulado integer,
  alunos_com_cronograma integer,
  cronogramas_gerados integer,
  blocos_criados integer,
  blocos_por_aluno_com_cronograma numeric,
  downloads_listas integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito a super_admin'
      using errcode = '42501';
  end if;

  return query
    select
      m.escolas_ativas,
      m.alunos_base_escolas_ativas,
      m.alunos_atendidos,
      m.alunos_com_simulado,
      m.alunos_com_cronograma,
      m.cronogramas_gerados,
      m.blocos_criados,
      m.blocos_por_aluno_com_cronograma,
      m.downloads_listas
    from public.executive_operation_metrics m;
end;
$$;

create or replace function public.get_executive_storage_metrics()
returns table(
  storage_objects integer,
  storage_bytes bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito a super_admin'
      using errcode = '42501';
  end if;

  return query
    select m.storage_objects, m.storage_bytes
    from public.executive_storage_metrics m;
end;
$$;

create or replace function public.get_executive_school_activity(
  p_school_id uuid default null,
  p_only_active boolean default false
)
returns table(
  school_id uuid,
  escola text,
  slug text,
  alunos_base integer,
  alunos_com_simulado integer,
  alunos_com_cronograma integer,
  alunos_atendidos integer,
  cronogramas_gerados integer,
  blocos_criados integer,
  downloads_listas integer,
  alunos_com_download integer,
  escola_ativa boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_school_id is null and not public.is_super_admin() then
    raise exception 'Acesso restrito a super_admin'
      using errcode = '42501';
  end if;

  if p_school_id is not null
     and not public.is_super_admin()
     and public.current_school_id() is distinct from p_school_id then
    raise exception 'Acesso restrito a escola do usuario'
      using errcode = '42501';
  end if;

  return query
    select
      a.school_id,
      a.escola,
      a.slug,
      a.alunos_base,
      a.alunos_com_simulado,
      a.alunos_com_cronograma,
      a.alunos_atendidos,
      a.cronogramas_gerados,
      a.blocos_criados,
      a.downloads_listas,
      a.alunos_com_download,
      a.escola_ativa
    from public.executive_school_activity a
    where (p_school_id is null or a.school_id = p_school_id)
      and (not p_only_active or a.escola_ativa);
end;
$$;

revoke all on function public.get_executive_operation_metrics() from public;
revoke all on function public.get_executive_operation_metrics() from anon;
grant execute on function public.get_executive_operation_metrics() to authenticated;

revoke all on function public.get_executive_storage_metrics() from public;
revoke all on function public.get_executive_storage_metrics() from anon;
grant execute on function public.get_executive_storage_metrics() to authenticated;

revoke all on function public.get_executive_school_activity(uuid, boolean) from public;
revoke all on function public.get_executive_school_activity(uuid, boolean) from anon;
grant execute on function public.get_executive_school_activity(uuid, boolean) to authenticated;

comment on function public.get_executive_operation_metrics() is
  'Metricas globais da Visao Executiva no PRIMARY; exige super_admin.';

comment on function public.get_executive_storage_metrics() is
  'Metricas de storage da Visao Executiva no PRIMARY; exige super_admin.';

comment on function public.get_executive_school_activity(uuid, boolean) is
  'Atividade executiva por escola no PRIMARY; exige super_admin e permite filtro opcional por escola/ativo.';
