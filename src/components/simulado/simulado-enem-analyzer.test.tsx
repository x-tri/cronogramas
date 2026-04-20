/**
 * Testes do SimuladoEnemAnalyzer — componente complementar que le os
 * novos simulados ENEM do banco primary contextualizados ao aluno.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mock do supabase ------------------------------------------------

interface QueryState {
  readonly table: string;
  readonly filters: Array<{ col: string; value: unknown }>;
}

type Resolver = (
  state: QueryState,
) =>
  | { data: unknown; error: { message: string } | null }
  | { data: unknown[] | null; error: { message: string } | null };

function makeQueryBuilder(state: QueryState, resolver: Resolver) {
  const qb: Record<string, unknown> = {
    select: vi.fn(() => qb),
    order: vi.fn(() => qb),
    eq: vi.fn((col: string, value: unknown) => {
      state = { ...state, filters: [...state.filters, { col, value }] };
      return qb;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(resolver(state))),
    then: (onFulfilled: (r: ReturnType<Resolver>) => unknown) =>
      Promise.resolve(resolver(state)).then(onFulfilled),
  };
  return qb;
}

function mockSupabaseWith(resolver: Resolver) {
  vi.doMock("../../lib/supabase", () => ({
    supabase: {
      from: vi.fn((table: string) =>
        makeQueryBuilder({ table, filters: [] }, resolver),
      ),
    },
  }));
}

async function importComponent() {
  const mod = await import("./simulado-enem-analyzer");
  return mod.SimuladoEnemAnalyzer;
}

// --- Fixtures --------------------------------------------------------

const RESPOSTA_FIXTURE = {
  id: "resp-1",
  simulado_id: "sim-1",
  tri_lc: 620,
  tri_ch: 580,
  tri_cn: 700,
  tri_mt: 590,
  acertos_lc: 32,
  erros_lc: 10,
  branco_lc: 3,
  acertos_ch: 28,
  erros_ch: 15,
  branco_ch: 2,
  acertos_cn: 38,
  erros_cn: 5,
  branco_cn: 2,
  acertos_mt: 29,
  erros_mt: 14,
  branco_mt: 2,
  erros_por_topico: {
    "Funções exponenciais": 5,
    "Geometria analítica": 4,
    "Revolução Francesa": 3,
  },
  submitted_at: "2026-04-10T10:00:00Z",
  simulados: {
    title: "ENEM Simulado 1",
    published_at: "2026-04-08T00:00:00Z",
  },
};

// --- Tests -----------------------------------------------------------

describe("SimuladoEnemAnalyzer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  /** Resolver que encadeia: 1o students.id lookup + 2o simulado_respostas */
  function makeResolver(options: {
    studentId?: string | null;
    respostas: unknown[];
    lookupError?: { message: string } | null;
    respostasError?: { message: string } | null;
  }): Resolver {
    return (state) => {
      if (state.table === "students") {
        if (options.lookupError) return { data: null, error: options.lookupError };
        return { data: options.studentId ? { id: options.studentId } : null, error: null };
      }
      if (state.table === "simulado_respostas") {
        if (options.respostasError) return { data: null, error: options.respostasError };
        return { data: options.respostas, error: null };
      }
      return { data: [], error: null };
    };
  }

  it("compact: mostra estado 'Carregando' ao iniciar", async () => {
    mockSupabaseWith(
      () =>
        new Promise(() => {}) as unknown as ReturnType<Resolver>,
    );
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="compact" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it("compact: 'Nenhum respondido' quando lista vazia", async () => {
    mockSupabaseWith(makeResolver({ studentId: "uuid-1", respostas: [] }));
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="compact" />);
    expect(await screen.findByText(/Nenhum respondido/i)).toBeInTheDocument();
  });

  it("compact: botao tem aria-expanded=false quando fechado", async () => {
    mockSupabaseWith(makeResolver({ studentId: "uuid-1", respostas: [RESPOSTA_FIXTURE] }));
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="compact" />);
    await screen.findByText(/1 respondido/i);
    const btn = screen.getByRole("button", {
      name: /Simulados ENEM/i,
    });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("compact: click no botao expande e mostra TRI + top topicos", async () => {
    const user = userEvent.setup();
    mockSupabaseWith(makeResolver({ studentId: "uuid-1", respostas: [RESPOSTA_FIXTURE] }));
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="compact" />);

    await screen.findByText(/1 respondido/i);
    await user.click(
      screen.getByRole("button", { name: /Simulados ENEM/i }),
    );

    // TRI por area
    expect(screen.getByText("620")).toBeInTheDocument(); // LC
    expect(screen.getByText("580")).toBeInTheDocument(); // CH
    expect(screen.getByText("700")).toBeInTheDocument(); // CN
    expect(screen.getByText("590")).toBeInTheDocument(); // MT

    // Total acertos
    expect(screen.getByText("127/180")).toBeInTheDocument(); // 32+28+38+29

    // Top topicos
    expect(screen.getByText("Funções exponenciais")).toBeInTheDocument();
    expect(screen.getByText("Geometria analítica")).toBeInTheDocument();
  });

  it("resolve students.id via matricula + usa UUID em student_id", async () => {
    const allFilters: QueryState["filters"] = [];
    mockSupabaseWith((state) => {
      allFilters.push(...state.filters.map((f) => ({ ...f })));
      if (state.table === "students") {
        return { data: { id: "uuid-resolved-xyz" }, error: null };
      }
      return { data: [], error: null };
    });
    const Comp = await importComponent();
    render(<Comp matricula="matric-abc-123" variant="compact" />);

    await screen.findByText(/Nenhum respondido/i);
    expect(allFilters).toContainEqual({ col: "matricula", value: "matric-abc-123" });
    expect(allFilters).toContainEqual({ col: "student_id", value: "uuid-resolved-xyz" });
  });

  it("expoe erro se query de simulado_respostas falhar", async () => {
    mockSupabaseWith((state) => {
      if (state.table === "students") return { data: { id: "uuid-1" }, error: null };
      return { data: null, error: { message: "permission denied" } };
    });
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="default" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/permission denied/);
  });

  it("student lookup retorna null: estado vazio sem erro (avulso)", async () => {
    mockSupabaseWith((state) => {
      if (state.table === "students") return { data: null, error: null };
      return { data: [], error: null };
    });
    const Comp = await importComponent();
    render(<Comp matricula="matric-sem-vinculo" variant="compact" />);
    expect(await screen.findByText(/Nenhum respondido/i)).toBeInTheDocument();
  });

  it("default: abre panel imediatamente (sem click)", async () => {
    mockSupabaseWith((state) => {
      if (state.table === "students") return { data: { id: "uuid-1" }, error: null };
      return { data: [RESPOSTA_FIXTURE], error: null };
    });
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="default" />);
    await screen.findByText("620");
    expect(screen.getByText(/Simulados ENEM do aluno/i)).toBeInTheDocument();
  });

  it("trocar selecao no dropdown nao refaz fetch mas muda o detalhe", async () => {
    const user = userEvent.setup();
    const RESPOSTA2 = {
      ...RESPOSTA_FIXTURE,
      id: "resp-2",
      simulado_id: "sim-2",
      tri_lc: 450,
      tri_ch: 450,
      tri_cn: 450,
      tri_mt: 450,
      acertos_lc: 20,
      acertos_ch: 20,
      acertos_cn: 20,
      acertos_mt: 20,
      simulados: { title: "ENEM Simulado 2", published_at: null },
    };

    let respFetchCount = 0;
    mockSupabaseWith((state) => {
      if (state.table === "students") return { data: { id: "uuid-1" }, error: null };
      if (state.table === "simulado_respostas") {
        respFetchCount++;
        return { data: [RESPOSTA_FIXTURE, RESPOSTA2], error: null };
      }
      return { data: [], error: null };
    });
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="default" />);

    await screen.findByText("620");
    expect(respFetchCount).toBe(1);

    const select = screen.getByLabelText(/Simulado:/i);
    await user.selectOptions(select, "resp-2");

    await waitFor(() => {
      expect(screen.getAllByText("450").length).toBeGreaterThan(0);
    });
    expect(respFetchCount).toBe(1);
  });

  it("sem erros_por_topico mostra mensagem de sem erros", async () => {
    mockSupabaseWith((state) => {
      if (state.table === "students") return { data: { id: "uuid-1" }, error: null };
      return { data: [{ ...RESPOSTA_FIXTURE, erros_por_topico: {} }], error: null };
    });
    const Comp = await importComponent();
    render(<Comp matricula="12345" variant="default" />);

    expect(
      await screen.findByText(/Sem erros nesse simulado/i),
    ).toBeInTheDocument();
  });
});
