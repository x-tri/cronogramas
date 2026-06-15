# UI de meta SISU — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o aluno cadastre/edite sua meta SISU (universidade+curso, restrito a `sisu_cortes`) via CTA na tela de resultado, destravando o termômetro SISU.

**Architecture:** RPC `set_my_sisu_goal` (SECURITY DEFINER) é a única via de escrita (valida e deriva o corte no servidor). Catálogo (universidades/cursos) vem de `sisu_cortes`. Frontend: 2 hooks de catálogo + 1 mutation + componentes `SisuGoalPicker` (modal) e `SisuGoalCTA`, integrados em `SimuladoResultado.tsx`.

**Tech Stack:** Postgres/Supabase, React + TypeScript, @tanstack/react-query, shadcn (dialog, command, popover), Vitest.

Spec: `docs/superpowers/specs/2026-06-14-ui-meta-sisu-design.md`

---

## File Structure
- Create: `supabase/migrations/20260614170000_sisu_goal_rpcs.sql` — RPCs `get_sisu_universidades` + `set_my_sisu_goal`.
- Create: `aluno/src/hooks/useSisuCatalogo.ts` — `useSisuUniversidades()`, `useSisuCursos(sigla, uf)`.
- Create: `aluno/src/hooks/useSisuCatalogo.test.tsx`.
- Create: `aluno/src/hooks/useSetSisuGoal.ts` — mutation.
- Create: `aluno/src/hooks/useSetSisuGoal.test.tsx`.
- Create: `aluno/src/components/SisuGoalPicker.tsx` — modal (uni→curso→corte→salvar).
- Create: `aluno/src/components/SisuGoalPicker.test.tsx`.
- Create: `aluno/src/components/SisuGoalCTA.tsx` — card que abre o picker.
- Modify: `aluno/src/pages/SimuladoResultado.tsx` — CTA quando sem meta + ícone editar quando com meta.
- Reuse: `aluno/src/components/ui/{dialog,command,popover,button}.tsx`, `@/integrations/supabase/client`.

---

## Task 1: Backend — RPCs (migration)

**Files:**
- Create: `supabase/migrations/20260614170000_sisu_goal_rpcs.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Catálogo de universidades (distinct) para o seletor de meta SISU.
create or replace function public.get_sisu_universidades()
returns table(sigla text, uf text, nome text)
language sql stable security definer set search_path to 'public'
as $$
  select distinct sigla, uf, nome from public.sisu_cortes order by nome
$$;
grant execute on function public.get_sisu_universidades() to authenticated;

-- Define a meta SISU do PRÓPRIO aluno. Valida o curso na base e deriva o corte no servidor.
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

- [ ] **Step 2: Aplicar a migration**

Via MCP Supabase `apply_migration` (project `comwcnmvnuzqqbypjtqn`, name `sisu_goal_rpcs`) com o SQL acima.

- [ ] **Step 3: Testar via SQL (no projeto)**

```sql
-- universidades retorna 45 linhas distintas
select count(*) from public.get_sisu_universidades();        -- esperado: 45
-- curso válido p/ UFRN existe e tem corte
select nota_corte from public.sisu_cortes where sigla='UFRN' and uf='RN' and curso='Medicina' order by ano desc limit 1;
```
Expected: 45 universidades; uma nota de corte numérica para Medicina/UFRN.
(O caminho `set_my_sisu_goal` depende de `auth.uid()`; será validado de ponta a ponta na Task 5/integração.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260614170000_sisu_goal_rpcs.sql
git commit -m "feat(sisu): RPCs get_sisu_universidades + set_my_sisu_goal"
```

---

## Task 2: Hooks de catálogo (`useSisuUniversidades`, `useSisuCursos`)

**Files:**
- Create: `aluno/src/hooks/useSisuCatalogo.ts`
- Test: `aluno/src/hooks/useSisuCatalogo.test.tsx`

- [ ] **Step 1: Escrever os testes (falhando)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSisuUniversidades, useSisuCursos } from "./useSisuCatalogo";

const cursosRows = [
  { curso: "Medicina", nota_corte: 780, ano: 2025 },
  { curso: "Medicina", nota_corte: 784, ano: 2026 }, // ano mais recente vence
  { curso: "Direito", nota_corte: 699, ano: 2026 },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({
      data: [{ sigla: "UFRN", uf: "RN", nome: "Universidade Federal do Rio Grande do Norte" }],
      error: null,
    })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: cursosRows, error: null })),
          })),
        })),
      })),
    })),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useSisuUniversidades", () => {
  it("retorna a lista de universidades da RPC", async () => {
    const { result } = renderHook(() => useSisuUniversidades(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0]).toMatchObject({ sigla: "UFRN", uf: "RN" });
  });
});

describe("useSisuCursos", () => {
  it("dedup por curso mantendo o ano mais recente", async () => {
    const { result } = renderHook(() => useSisuCursos("UFRN", "RN"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const med = result.current.data!.find((c) => c.curso === "Medicina");
    expect(med?.nota_corte).toBe(784); // 2026, não 2025
    expect(result.current.data).toHaveLength(2); // Medicina + Direito
  });

  it("desabilitado sem sigla/uf", () => {
    const { result } = renderHook(() => useSisuCursos(undefined, undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd aluno && npx vitest run src/hooks/useSisuCatalogo.test.tsx`
Expected: FAIL ("Cannot find module './useSisuCatalogo'").

- [ ] **Step 3: Implementar**

```ts
// aluno/src/hooks/useSisuCatalogo.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SisuUniversidade { sigla: string; uf: string; nome: string }
export interface SisuCursoCorte { curso: string; nota_corte: number }

export function useSisuUniversidades() {
  return useQuery({
    queryKey: ["sisu-universidades"],
    queryFn: async (): Promise<SisuUniversidade[]> => {
      const { data, error } = await supabase.rpc("get_sisu_universidades");
      if (error) throw new Error(error.message);
      return (data ?? []) as SisuUniversidade[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useSisuCursos(sigla: string | undefined, uf: string | undefined) {
  return useQuery({
    queryKey: ["sisu-cursos", sigla, uf],
    queryFn: async (): Promise<SisuCursoCorte[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sisu_cortes")
        .select("curso, nota_corte, ano")
        .eq("sigla", sigla)
        .eq("uf", uf)
        .order("ano", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ curso: string; nota_corte: number; ano: number }>;
      // dedup por curso mantendo a primeira ocorrência (ano mais recente, pois ordenado desc)
      const byCurso = new Map<string, number>();
      for (const r of rows) if (!byCurso.has(r.curso)) byCurso.set(r.curso, Number(r.nota_corte));
      return [...byCurso.entries()]
        .map(([curso, nota_corte]) => ({ curso, nota_corte }))
        .sort((a, b) => a.curso.localeCompare(b.curso));
    },
    enabled: Boolean(sigla && uf),
    staleTime: 60 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd aluno && npx vitest run src/hooks/useSisuCatalogo.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add aluno/src/hooks/useSisuCatalogo.ts aluno/src/hooks/useSisuCatalogo.test.tsx
git commit -m "feat(sisu): hooks de catálogo (universidades + cursos)"
```

---

## Task 3: Mutation `useSetSisuGoal`

**Files:**
- Create: `aluno/src/hooks/useSetSisuGoal.ts`
- Test: `aluno/src/hooks/useSetSisuGoal.test.tsx`

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSetSisuGoal } from "./useSetSisuGoal";

const rpc = vi.fn(() => Promise.resolve({
  data: [{ sisu_curso_nome: "Medicina", sisu_universidade: "UFRN", sisu_uf: "RN", sisu_nota_corte: 784 }],
  error: null,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useSetSisuGoal", () => {
  it("chama a RPC com os args e resolve", async () => {
    const { result } = renderHook(() => useSetSisuGoal("stu-1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ sigla: "UFRN", uf: "RN", curso: "Medicina" });
    });
    expect(rpc).toHaveBeenCalledWith("set_my_sisu_goal", { p_sigla: "UFRN", p_uf: "RN", p_curso: "Medicina" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd aluno && npx vitest run src/hooks/useSetSisuGoal.test.tsx`
Expected: FAIL ("Cannot find module './useSetSisuGoal'").

- [ ] **Step 3: Implementar**

```ts
// aluno/src/hooks/useSetSisuGoal.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SetSisuGoalArgs { sigla: string; uf: string; curso: string }

export function useSetSisuGoal(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sigla, uf, curso }: SetSisuGoalArgs) => {
      const { data, error } = await supabase.rpc("set_my_sisu_goal", {
        p_sigla: sigla, p_uf: uf, p_curso: curso,
      });
      if (error) throw new Error(error.message ?? "Falha ao salvar a meta.");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sisu-goal", studentId] });
    },
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd aluno && npx vitest run src/hooks/useSetSisuGoal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aluno/src/hooks/useSetSisuGoal.ts aluno/src/hooks/useSetSisuGoal.test.tsx
git commit -m "feat(sisu): mutation useSetSisuGoal (RPC + invalidação)"
```

---

## Task 4: Componentes `SisuGoalCTA` + `SisuGoalPicker`

**Files:**
- Create: `aluno/src/components/SisuGoalCTA.tsx`
- Create: `aluno/src/components/SisuGoalPicker.tsx`
- Test: `aluno/src/components/SisuGoalPicker.test.tsx`

- [ ] **Step 1: Escrever o teste do picker (falhando)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SisuGoalPicker } from "./SisuGoalPicker";

const mutateAsync = vi.fn(() => Promise.resolve(null));
vi.mock("@/hooks/useSisuCatalogo", () => ({
  useSisuUniversidades: () => ({ data: [{ sigla: "UFRN", uf: "RN", nome: "UFRN" }], isLoading: false }),
  useSisuCursos: (sigla?: string) => ({
    data: sigla ? [{ curso: "Medicina", nota_corte: 784 }] : [],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useSetSisuGoal", () => ({
  useSetSisuGoal: () => ({ mutateAsync, isPending: false }),
}));

describe("SisuGoalPicker", () => {
  it("seleciona uni → curso → salva chamando a mutation e o onSaved", async () => {
    const onSaved = vi.fn();
    render(<SisuGoalPicker open onOpenChange={() => {}} studentId="stu-1" onSaved={onSaved} />);
    fireEvent.click(screen.getByTestId("pick-uni-UFRN"));
    fireEvent.click(screen.getByTestId("pick-curso-Medicina"));
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ sigla: "UFRN", uf: "RN", curso: "Medicina" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd aluno && npx vitest run src/components/SisuGoalPicker.test.tsx`
Expected: FAIL ("Cannot find module './SisuGoalPicker'").

- [ ] **Step 3: Implementar o picker**

```tsx
// aluno/src/components/SisuGoalPicker.tsx
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSisuUniversidades, useSisuCursos } from "@/hooks/useSisuCatalogo";
import { useSetSisuGoal } from "@/hooks/useSetSisuGoal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | undefined;
  onSaved: () => void;
}

export function SisuGoalPicker({ open, onOpenChange, studentId, onSaved }: Props) {
  const [busca, setBusca] = useState("");
  const [uni, setUni] = useState<{ sigla: string; uf: string; nome: string } | null>(null);
  const [curso, setCurso] = useState<{ curso: string; nota_corte: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: unis = [] } = useSisuUniversidades();
  const { data: cursos = [] } = useSisuCursos(uni?.sigla, uni?.uf);
  const { mutateAsync, isPending } = useSetSisuGoal(studentId);

  const unisFiltradas = useMemo(
    () => unis.filter((u) => `${u.nome} ${u.sigla}`.toLowerCase().includes(busca.toLowerCase())),
    [unis, busca],
  );

  async function salvar() {
    if (!uni || !curso) return;
    setErro(null);
    try {
      await mutateAsync({ sigla: uni.sigla, uf: uni.uf, curso: curso.curso });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>🎯 Defina sua meta SISU</DialogTitle></DialogHeader>
        {!uni ? (
          <div className="space-y-2">
            <Input placeholder="Buscar universidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <ul className="max-h-64 overflow-auto space-y-1">
              {unisFiltradas.map((u) => (
                <li key={`${u.sigla}-${u.uf}`}>
                  <button type="button" data-testid={`pick-uni-${u.sigla}`}
                    onClick={() => { setUni(u); setCurso(null); }}
                    className="w-full rounded-lg border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-bold">{u.sigla}</span> · {u.uf} <span className="text-muted-foreground">— {u.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !curso ? (
          <div className="space-y-2">
            <button type="button" onClick={() => setUni(null)} className="text-xs text-muted-foreground">← trocar universidade ({uni.sigla})</button>
            <ul className="max-h-64 overflow-auto space-y-1">
              {cursos.map((c) => (
                <li key={c.curso}>
                  <button type="button" data-testid={`pick-curso-${c.curso}`}
                    onClick={() => setCurso(c)}
                    className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-bold">{c.curso}</span>
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(c.nota_corte)} pts</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Meta: <b>{curso.curso}</b> · {uni.sigla}/{uni.uf}</p>
            <p className="text-xs text-muted-foreground">Nota de corte: {Math.round(curso.nota_corte)} pts</p>
            {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurso(null)} className="flex-1">Voltar</Button>
              <Button onClick={salvar} disabled={isPending} className="flex-1">{isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Implementar o CTA**

```tsx
// aluno/src/components/SisuGoalCTA.tsx
import { useState } from "react";
import { SisuGoalPicker } from "./SisuGoalPicker";

export function SisuGoalCTA({ studentId, onSaved }: { studentId: string | undefined; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-dashed bg-card p-4 text-center">
      <p className="text-sm font-black">🎯 Defina sua meta SISU</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Escolha seu curso e universidade pra ver quanto falta pra passar.
      </p>
      <button type="button" onClick={() => setOpen(true)}
        className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground">
        Escolher meta
      </button>
      <SisuGoalPicker open={open} onOpenChange={setOpen} studentId={studentId} onSaved={onSaved} />
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd aluno && npx vitest run src/components/SisuGoalPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add aluno/src/components/SisuGoalPicker.tsx aluno/src/components/SisuGoalCTA.tsx aluno/src/components/SisuGoalPicker.test.tsx
git commit -m "feat(sisu): SisuGoalPicker (modal) + SisuGoalCTA"
```

---

## Task 5: Integrar em `SimuladoResultado.tsx`

**Files:**
- Modify: `aluno/src/pages/SimuladoResultado.tsx` (bloco do termômetro SISU, ~linha 785-795)

- [ ] **Step 1: Importar e renderizar o CTA quando sem meta**

No topo do arquivo, adicionar:
```tsx
import { SisuGoalCTA } from "@/components/SisuGoalCTA";
```
No bloco SISU (logo após o `{thermometer && sisuGoal?.sisu_curso_nome && …}` e o card de fallback), adicionar o caso "sem meta":
```tsx
{/* Sem meta cadastrada → CTA para definir */}
{!sisuGoal?.sisu_curso_nome && (
  <SisuGoalCTA
    studentId={student?.id}
    onSaved={() => { /* invalidação cuidada pela mutation; o termômetro reaparece */ }}
  />
)}
```

- [ ] **Step 2: Adicionar o ícone "editar" no termômetro**

No componente `SisuThermometer` (`aluno/src/components/SisuThermometer.tsx`), no header onde mostra "🎯 Sua meta SISU", adicionar um botão opcional `onEdit?: () => void` que, quando passado, renderiza um ícone (lucide `Pencil`, h-3 w-3) ao lado do título. Em `SimuladoResultado.tsx`, passar `onEdit={() => setEditMeta(true)}` e renderizar `<SisuGoalPicker open={editMeta} onOpenChange={setEditMeta} studentId={student?.id} onSaved={() => setEditMeta(false)} />` (estado `const [editMeta, setEditMeta] = useState(false)`).

- [ ] **Step 3: Typecheck + testes da página**

Run: `cd aluno && npx tsc -b --noEmit && npx vitest run`
Expected: sem erros novos de tipo; suíte do aluno verde (65 + novos).

- [ ] **Step 4: Commit**

```bash
git add aluno/src/pages/SimuladoResultado.tsx aluno/src/components/SisuThermometer.tsx
git commit -m "feat(sisu): CTA de meta na tela de resultado + editar meta"
```

---

## Task 6: Verificação end-to-end (preview local)

- [ ] **Step 1:** Subir o preview do aluno (porta 8082) e logar como um aluno **sem meta** (ex.: uma matrícula sem `sisu_curso_nome`). Abrir um resultado de simulado → deve aparecer o card "Defina sua meta SISU".
- [ ] **Step 2:** Escolher UFRN → Medicina → Salvar. O modal fecha e o **termômetro aparece** (sem reload), com a faixa de cursos e "FALTAM X pts".
- [ ] **Step 3:** Conferir no banco: `select sisu_curso_nome, sisu_universidade, sisu_uf, sisu_nota_corte from students where id='<id>'` → preenchido.
- [ ] **Step 4:** Clicar no ícone "editar" → trocar pra outro curso → confirmar atualização.

---

## Self-Review
- **Cobertura da spec:** RPC set_my_sisu_goal + get_sisu_universidades (T1); hooks catálogo (T2); mutation (T3); SisuGoalPicker+CTA (T4); integração CTA+editar (T5); E2E (T6). Segurança (RPC SECURITY DEFINER, corte server-side) em T1. ✔
- **Placeholders:** nenhum "TBD"; todo passo tem código/SQL/comando. ✔ (T5 step 2 descreve a edição do SisuThermometer em prosa porque é uma adição pequena num componente existente; o contrato `onEdit?: () => void` está explícito.)
- **Consistência de tipos:** `SisuUniversidade {sigla,uf,nome}`, `SisuCursoCorte {curso,nota_corte}`, `SetSisuGoalArgs {sigla,uf,curso}`, RPC args `{p_sigla,p_uf,p_curso}` — usados iguais entre tasks. `useSetSisuGoal(studentId)` mesma assinatura em T3/T4. ✔
- **Dependência:** o termômetro com cortes reais 2025/2026 exige o deploy do aluno (`67e2d7c`) — fora do escopo deste plano (track paralelo).
