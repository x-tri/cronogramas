-- RPCs para o cadastro de meta SISU pelo aluno (portal do aluno).
--
-- get_sisu_universidades(): catálogo de universidades distintas (para o seletor).
-- set_my_sisu_goal(): define a meta SISU do PRÓPRIO aluno autenticado, validando
--   o curso na base sisu_cortes e derivando a nota de corte no servidor (cliente
--   não envia o valor → não há adulteração). Única via de escrita de students.sisu_*.

create or replace function public.get_sisu_universidades()
returns table(sigla text, uf text, nome text)
language sql stable security definer set search_path to 'public'
as $$
  select distinct sigla, uf, nome from public.sisu_cortes order by nome
$$;
grant execute on function public.get_sisu_universidades() to authenticated;

create or replace function public.set_my_sisu_goal(p_sigla text, p_uf text, p_curso text)
returns table(sisu_curso_nome text, sisu_universidade text, sisu_uf text, sisu_nota_corte numeric)
language plpgsql security definer set search_path to 'public'
as $$
declare v_student_id uuid; v_corte numeric;
begin
  select id into v_student_id
  from public.students where profile_id = auth.uid() order by id limit 1;
  if v_student_id is null then raise exception 'aluno nao encontrado'; end if;

  select nota_corte into v_corte
  from public.sisu_cortes
  where sigla = upper(btrim(p_sigla)) and uf = upper(btrim(p_uf)) and curso = p_curso
  order by ano desc limit 1;
  if v_corte is null then raise exception 'curso/universidade fora da base de cortes'; end if;

  update public.students
  set sisu_curso_nome = p_curso,
      sisu_universidade = upper(btrim(p_sigla)),
      sisu_uf = upper(btrim(p_uf)),
      sisu_nota_corte = v_corte,
      sisu_updated_at = now()
  where id = v_student_id;

  return query select p_curso, upper(btrim(p_sigla)), upper(btrim(p_uf)), v_corte;
end; $$;
grant execute on function public.set_my_sisu_goal(text,text,text) to authenticated;
