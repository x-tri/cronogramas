/**
 * Testes dos hooks de simulados do aluno (Fase 4).
 *
 * Mocka @/integrations/supabase/client e testa query/mutation flows
 * integrando com React Query.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSimuladosPendentes,
  useSimuladoResultado,
  useSubmitSimulado,
} from "./useSimulados";
import type { ReactNode } from "react";

interface RpcCall {
  fn: string;
  args?: unknown;
}
interface InvokeCall {
  name: string;
  body: unknown;
}

let rpcCalls: RpcCall[] = [];
let invokeCalls: InvokeCall[] = [];
let rpcResolver: (fn: string, args: unknown) => { data: unknown; error: { message: string } | null } = () => ({
  data: null,
  error: null,
});
let invokeResolver: (name: string, body: unknown) => { data: unknown; error: { message: string } | null } = () => ({
  data: null,
  error: null,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResolver(fn, args));
    }),
    functions: {
      invoke: vi.fn((name: string, opts: { body: unknown }) => {
        invokeCalls.push({ name, body: opts.body });
        return Promise.resolve(invokeResolver(name, opts.body));
      }),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// --- Probe components (expoem o resultado do hook no DOM) -----------------

function ProbePendentes() {
  const { data, isLoading, error } = useSimuladosPendentes();
  if (isLoading) return <div>loading</div>;
  if (error) return <div data-testid="error">{error.message}</div>;
  return (
    <ul data-testid="list">
      {data?.map((s) => (
        <li key={s.id}>
          {s.title} - ja:{String(s.ja_respondeu)}
        </li>
      ))}
    </ul>
  );
}

function ProbeResultado({ id }: { id: string | undefined }) {
  const { data, isLoading } = useSimuladoResultado(id);
  if (isLoading) return <div>loading</div>;
  if (!data) return <div>no-data</div>;
  return <div data-testid="resultado">{data.submitted ? "submitted" : "not-submitted"}</div>;
}

function ProbeSubmit() {
  const submit = useSubmitSimulado();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          submit.mutate({ simuladoId: "sim-1", answers: { "1": "A" } })
        }
      >
        enviar
      </button>
      {submit.isError && <div data-testid="submit-error">{submit.error.message}</div>}
      {submit.data && <div data-testid="submit-ok">{submit.data.resposta_id}</div>}
    </div>
  );
}

// --------------------------------------------------------------------------

describe("useSimuladosPendentes", () => {
  beforeEach(() => {
    rpcCalls = [];
    invokeCalls = [];
  });

  it("retorna lista vazia sem erro", async () => {
    rpcResolver = () => ({ data: [], error: null });
    render(<ProbePendentes />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId("list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("list").children).toHaveLength(0);
    expect(rpcCalls[0]).toEqual({ fn: "get_student_simulados_pendentes", args: undefined });
  });

  it("renderiza simulados pendentes e respondidos", async () => {
    rpcResolver = () => ({
      data: [
        { id: "a", title: "Sim A", school_id: "s", turmas: [], published_at: null, ja_respondeu: false, submitted_at: null },
        { id: "b", title: "Sim B", school_id: "s", turmas: [], published_at: null, ja_respondeu: true, submitted_at: "2026-04-10T00:00:00Z" },
      ],
      error: null,
    });
    render(<ProbePendentes />, { wrapper });
    await screen.findByText(/Sim A - ja:false/);
    expect(screen.getByText(/Sim B - ja:true/)).toBeInTheDocument();
  });

  it("expoe erro quando RPC falha", async () => {
    rpcResolver = () => ({ data: null, error: { message: "permission denied" } });
    render(<ProbePendentes />, { wrapper });
    await screen.findByTestId("error");
    expect(screen.getByTestId("error")).toHaveTextContent("permission denied");
  });
});

describe("useSimuladoResultado", () => {
  beforeEach(() => {
    rpcCalls = [];
  });

  it("nao chama RPC quando id e undefined", async () => {
    rpcResolver = () => ({ data: null, error: null });
    render(<ProbeResultado id={undefined} />, { wrapper });
    // Query desabilitada — nenhuma chamada feita.
    expect(rpcCalls).toHaveLength(0);
  });

  it("retorna submitted=true apos RPC", async () => {
    rpcResolver = () => ({
      data: { simulado: { id: "x" }, resposta: {}, itens: [], submitted: true },
      error: null,
    });
    render(<ProbeResultado id="x" />, { wrapper });
    const el = await screen.findByTestId("resultado");
    expect(el).toHaveTextContent("submitted");
    expect(rpcCalls[0]).toEqual({
      fn: "get_student_simulado_resultado",
      args: { p_simulado_id: "x" },
    });
  });

  it("retorna submitted=false quando aluno nao respondeu", async () => {
    rpcResolver = () => ({
      data: { simulado: { id: "x" }, resposta: null, itens: null, submitted: false },
      error: null,
    });
    render(<ProbeResultado id="x" />, { wrapper });
    const el = await screen.findByTestId("resultado");
    expect(el).toHaveTextContent("not-submitted");
  });
});

describe("useSubmitSimulado", () => {
  beforeEach(() => {
    rpcCalls = [];
    invokeCalls = [];
  });

  it("chama Edge Function com body correto em sucesso", async () => {
    invokeResolver = () => ({
      data: {
        resposta_id: "resp-1",
        tri: { LC: 500, CH: null, CN: null, MT: null },
        totais: { acertos: 0, erros: 0, branco: 180, respondidas: 0 },
        por_area: {
          LC: { acertos: 0, erros: 0, branco: 45 },
          CH: { acertos: 0, erros: 0, branco: 45 },
          CN: { acertos: 0, erros: 0, branco: 45 },
          MT: { acertos: 0, erros: 0, branco: 45 },
        },
        erros_por_topico: {},
        erros_por_habilidade: {},
        submitted_at: "2026-04-17T10:00:00Z",
      },
      error: null,
    });
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ProbeSubmit />, { wrapper });
    await user.click(screen.getByRole("button", { name: /enviar/ }));

    await screen.findByTestId("submit-ok");
    expect(screen.getByTestId("submit-ok")).toHaveTextContent("resp-1");
    expect(invokeCalls[0]).toEqual({
      name: "submit-simulado",
      body: { simulado_id: "sim-1", answers: { "1": "A" } },
    });
  });

  it("expoe erro quando Edge Function falha", async () => {
    invokeResolver = () => ({ data: null, error: { message: "already_submitted" } });
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ProbeSubmit />, { wrapper });
    await user.click(screen.getByRole("button", { name: /enviar/ }));
    await screen.findByTestId("submit-error");
    expect(screen.getByTestId("submit-error")).toHaveTextContent("already_submitted");
  });

  it("erro se data ausente no retorno do Edge Function", async () => {
    invokeResolver = () => ({ data: null, error: null });
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ProbeSubmit />, { wrapper });
    await user.click(screen.getByRole("button", { name: /enviar/ }));
    await screen.findByTestId("submit-error");
    expect(screen.getByTestId("submit-error")).toHaveTextContent(/invalida/i);
  });
});
