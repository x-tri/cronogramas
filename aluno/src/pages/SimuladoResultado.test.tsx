import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import SimuladoResultado from "./SimuladoResultado";

vi.mock("@/hooks/useSimulados", () => ({
  useSimuladoResultado: vi.fn(),
}));

vi.mock("@/hooks/useStudentData", () => ({
  useStudentProfile: vi.fn(),
}));

vi.mock("@/hooks/useSisuGoal", () => ({
  useSisuGoal: vi.fn(),
}));

vi.mock("@/hooks/useSisuCortes", () => ({
  useSisuCortes: vi.fn(),
}));

vi.mock("@/components/SisuGoalCTA", () => ({
  SisuGoalCTA: ({ studentId }: { studentId: string | undefined }) => (
    <div data-testid="sisu-goal-cta">Defina sua meta SISU · {studentId}</div>
  ),
}));

vi.mock("@/components/SisuGoalPicker", () => ({
  SisuGoalPicker: () => null,
}));

vi.mock("@/components/SisuThermometer", () => ({
  SisuThermometer: () => <div data-testid="sisu-thermometer">Termometro SISU</div>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSimuladoResultado } = (await import("@/hooks/useSimulados")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useStudentProfile } = (await import("@/hooks/useStudentData")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSisuGoal } = (await import("@/hooks/useSisuGoal")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSisuCortes } = (await import("@/hooks/useSisuCortes")) as any;

function renderResultado(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/simulados/sim-1/resultado"]}>
        <Routes>
          <Route path="/simulados/:id/resultado" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function resultadoRespondido() {
  // Fixture sintetica: valida apenas a renderizacao da UI, sem representar
  // resultado real de aluno, escola ou simulado.
  return {
    simulado: {
      id: "sim-1",
      title: "Simulado ENEM",
      school_id: "school-1",
      turmas: ["3A"],
      status: "published",
      published_at: "2026-06-01T00:00:00Z",
      closed_at: null,
    },
    resposta: {
      id: "resp-1",
      simulado_id: "sim-1",
      student_id: "stu-1",
      answers: {},
      tri_lc: 620,
      tri_ch: 610,
      tri_cn: 590,
      tri_mt: 640,
      acertos_lc: 30,
      erros_lc: 10,
      branco_lc: 5,
      acertos_ch: 31,
      erros_ch: 9,
      branco_ch: 5,
      acertos_cn: 25,
      erros_cn: 15,
      branco_cn: 5,
      acertos_mt: 28,
      erros_mt: 12,
      branco_mt: 5,
      erros_por_topico: {},
      erros_por_habilidade: {},
      submitted_at: "2026-06-01T10:00:00Z",
    },
    itens: [],
    submitted: true,
  };
}

describe("SimuladoResultado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSimuladoResultado.mockReturnValue({
      data: resultadoRespondido(),
      isLoading: false,
      error: null,
    });
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", profile_id: "profile-1" },
      isLoading: false,
    });
    useSisuCortes.mockReturnValue({ data: [], isLoading: false });
  });

  it("mostra o CTA SISU logo no topo quando o aluno ainda nao definiu meta", () => {
    useSisuGoal.mockReturnValue({ data: null, isLoading: false });

    const { container } = renderResultado(<SimuladoResultado />);

    expect(screen.getByTestId("sisu-goal-cta")).toHaveTextContent(
      "Defina sua meta SISU · stu-1",
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("Defina sua meta SISU")).toBeLessThan(
      text.indexOf("Notas por área"),
    );
  });
});
