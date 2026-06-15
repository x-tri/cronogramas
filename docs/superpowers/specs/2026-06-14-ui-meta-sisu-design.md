# UI de cadastro de meta SISU (portal do aluno)

Data: 2026-06-14
Status: aprovado (aguardando review da spec)

## Problema

O termômetro SISU (`SisuThermometer`) na tela de resultado do simulado só renderiza quando o
aluno tem meta cadastrada (`students.sisu_curso_nome` + `sisu_nota_corte`). Hoje **não existe
nenhuma tela/fluxo que escreva esses campos** — só foram preenchidos por seed (a partir dos
Relatórios Cirúrgicos, 48 alunos) e manualmente (QA). Os ~1.220 alunos restantes não têm como
definir a meta → nunca veem o card.

## Objetivo

Permitir que o aluno **cadastre/edite a própria meta SISU** (universidade + curso), restrito à
base de cortes `sisu_cortes` (45 universidades, 437 cursos, anos 2025/2026), via um seletor
acessível na tela de resultado. Ao salvar, o termômetro passa a renderizar.

### Não-objetivos
- Não cobrir cursos/universidades fora de `sisu_cortes` (v1 restringe à base).
- Não criar página/aba dedicada (a entrada é um CTA na tela de resultado).
- Não recalcular cortes (a nota de corte vem de `sisu_cortes`).

## Decisões
| Tema | Decisão |
|------|---------|
| Ponto de entrada | CTA na tela de resultado: sem meta → card "🎯 Defina sua meta SISU" no lugar do termômetro |
| Fonte do seletor | `sisu_cortes` (restrito à base); nota de corte derivada do servidor |
| Persistência | RPC `set_my_sisu_goal` (SECURITY DEFINER) — única via de escrita; sem expor UPDATE de `students` por RLS |
| Edição | Ícone "editar" discreto no termômetro reabre o mesmo seletor (reusa o componente) |

## Arquitetura

### Backend — migration (projeto comwcnmvnuzqqbypjtqn)
RPC que valida e escreve, escopada ao aluno autenticado:

```sql
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
```

### Frontend — aluno/src
Hooks novos (mesmo padrão de `useSisuGoal`/`useSisuCortes`):
- `useSisuUniversidades()` → `select distinct sigla, uf, nome from sisu_cortes order by nome` (45 linhas).
- `useSisuCursos(sigla, uf)` → por curso da uni, a nota de corte do **ano mais recente**
  (`select distinct on (curso) curso, nota_corte from sisu_cortes where sigla=… and uf=… order by curso, ano desc`),
  para preview no seletor (enabled só quando sigla+uf presentes). A RPC re-deriva o corte ao salvar.
- `useSetSisuGoal()` → mutation `supabase.rpc('set_my_sisu_goal', {...})`; onSuccess invalida `["sisu-goal", studentId]`.

Componentes novos:
- `SisuGoalPicker` (modal/dialog): combobox universidade (busca entre 45) → combobox curso (busca entre ≤87)
  → preview do corte selecionado → botão "Salvar". Usa os hooks acima + a mutation. Loading/erro tratados.
- `SisuGoalCTA` (card): texto "🎯 Defina sua meta SISU" + botão que abre o `SisuGoalPicker`.

Integração em `aluno/src/pages/SimuladoResultado.tsx`:
- Onde hoje renderiza o termômetro: se `!sisuGoal?.sisu_curso_nome` → renderiza `<SisuGoalCTA/>`.
- Com meta: o `SisuThermometer` ganha um ícone "editar" no header que abre o mesmo `SisuGoalPicker`.

## Fluxo de dados
1. Picker lê `sisu_cortes` (RLS `sisu_cortes_select_authenticated` já permite authenticated).
2. "Salvar" → `useSetSisuGoal` → RPC `set_my_sisu_goal` (valida + escreve `students.sisu_*`).
3. onSuccess invalida `["sisu-goal"]` → `useSisuGoal` refaz → `useSisuCortes` dispara → termômetro renderiza, sem reload.

## Segurança
- RPC `SECURITY DEFINER` resolve o aluno por `auth.uid()` → escreve **só a própria linha**.
- A nota de corte é derivada no servidor de `sisu_cortes` (cliente não envia valor → não há adulteração).
- Só os campos `sisu_*` são alterados. Nenhuma política de UPDATE em `students` é exposta.

## Plano de testes
- Unit (vitest, mock do supabase): `useSisuUniversidades`/`useSisuCursos`/`useSetSisuGoal` (shape + invalidação).
- Componente: `SisuGoalPicker` — selecionar uni → curso → salvar chama a mutation com os args certos; estado de erro.
- RPC (SQL): curso válido escreve e retorna o corte correto; curso inexistente levanta erro; escopo (não altera outro aluno).
- Integração leve: `SimuladoResultado` renderiza `SisuGoalCTA` quando sem meta e termômetro quando com meta.

## Casos de borda
- Aluno sem `profile_id`/sem students → RPC levanta erro (UI mostra mensagem amigável).
- Curso/uni fora da base → restringido pelo próprio seletor (só lista o que existe); RPC valida em dobro.
- Troca de meta (editar) → mesma RPC sobrescreve; `sisu_updated_at` registra.
- `sigla`/`uf` sempre normalizados (upper/trim) para casar com `sisu_cortes` e com o que o termômetro consulta.

## Dependência externa
Para o termômetro mostrar os cortes **2025/2026** (e funcionar para unis além de UFRN), a produção
precisa do build com `useSisuCortes`/`buildUniversidadeFromCortes` (commit `67e2d7c`) — **deploy do
aluno pendente** (track paralelo). Sem o deploy, esta feature cadastra a meta, mas em produção o
termômetro ainda cairia na lista hardcoded 2024 (só UFRN).
