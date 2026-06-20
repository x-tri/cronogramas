-- Visão Executiva: remove exposição por aluno da métrica de blocos.
--
-- A view `executive_blocos_por_aluno` retorna `aluno_id` + contagem de blocos.
-- Em views sem `security_invoker`, o PostgREST pode expor dados fora do RLS da
-- tabela base. O dashboard só precisa da distribuição numérica para calcular a
-- mediana global, então o RPC abaixo retorna apenas `blocos` e exige super_admin.

revoke all on table public.executive_blocos_por_aluno from public;
revoke all on table public.executive_blocos_por_aluno from anon;
revoke all on table public.executive_blocos_por_aluno from authenticated;

drop function if exists public.get_executive_blocos_distribution();

create or replace function public.get_executive_blocos_distribution()
returns table(blocos integer)
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
    select count(b.id)::integer as blocos
    from public.cronogramas c
    join public.blocos_cronograma b on b.cronograma_id = c.id
    group by c.aluno_id;
end;
$$;

revoke all on function public.get_executive_blocos_distribution() from public;
revoke all on function public.get_executive_blocos_distribution() from anon;
grant execute on function public.get_executive_blocos_distribution() to authenticated;

comment on view public.executive_blocos_por_aluno is
  'View legada interna. Grants revogados para evitar exposicao de aluno_id; usar get_executive_blocos_distribution().';

comment on function public.get_executive_blocos_distribution() is
  'Distribuicao agregada de blocos por aluno para mediana da Visao Executiva; exige super_admin e nao retorna aluno_id.';
