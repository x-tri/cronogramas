import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import Simulados from "./Simulados";

vi.mock("@/hooks/useSimulados", () => ({
  useSimuladosPendentes: vi.fn(),
}));

vi.mock("@/hooks/useStudentData", () => ({
  useStudentProfile: vi.fn(),
}));

vi.mock("@/hooks/useSisuGoal", () => ({
  useSisuGoal: vi.fn(),
}));

vi.mock("@/components/SisuGoalCTA", () => ({
  SisuGoalCTA: ({ studentId }: { studentId: string | undefined }) => (
    <div data-testid="sisu-goal-cta">Escolher meta SISU · {studentId}</div>
  ),
}));

vi.mock("@/components/SisuGoalPicker", () => ({
  SisuGoalPicker: ({ open }: { open: boolean }) =>
    open ? <div data-testid="sisu-goal-picker">Seletor SISU aberto</div> : null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSimuladosPendentes } = (await import("@/hooks/useSimulados")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useStudentProfile } = (await import("@/hooks/useStudentData")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSisuGoal } = (await import("@/hooks/useSisuGoal")) as any;

function renderPage(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Simulados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSimuladosPendentes.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", profile_id: "profile-1" },
      isLoading: false,
    });
  });

  it("mostra CTA para escolher meta SISU quando o aluno ainda nao definiu", () => {
    useSisuGoal.mockReturnValue({ data: null, isLoading: false });

    renderPage(<Simulados />);

    expect(screen.getByTestId("sisu-goal-cta")).toHaveTextContent(
      "Escolher meta SISU · stu-1",
    );
  });

  it("mostra a meta SISU salva na aba de simulados", () => {
    useSisuGoal.mockReturnValue({
      data: {
        sisu_curso_nome: "Curso Sintetico",
        sisu_universidade: "UNI",
        sisu_uf: "TS",
        sisu_nota_corte: 700.4,
      },
      isLoading: false,
    });

    renderPage(<Simulados />);

    expect(screen.getByText("Meta SISU")).toBeInTheDocument();
    expect(screen.getByText("Curso Sintetico")).toBeInTheDocument();
    expect(screen.getByText("UNI · TS")).toBeInTheDocument();
    expect(screen.getByText("Nota de corte: 700 pts")).toBeInTheDocument();
  });

  it("abre o seletor ao editar a meta SISU existente", () => {
    useSisuGoal.mockReturnValue({
      data: {
        sisu_curso_nome: "Curso Sintetico",
        sisu_universidade: "UNI",
        sisu_uf: "TS",
        sisu_nota_corte: 700,
      },
      isLoading: false,
    });

    renderPage(<Simulados />);
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByTestId("sisu-goal-picker")).toBeInTheDocument();
  });
});
