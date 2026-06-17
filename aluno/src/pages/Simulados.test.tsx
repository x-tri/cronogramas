import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/hooks/useSisuCatalogo", () => ({
  useSisuCursos: vi.fn(),
}));

vi.mock("@/hooks/useSetSisuGoal", () => ({
  useSetSisuGoal: vi.fn(),
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSisuCursos } = (await import("@/hooks/useSisuCatalogo")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useSetSisuGoal } = (await import("@/hooks/useSetSisuGoal")) as any;
const setSisuGoal = vi.fn();

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
    useSisuCursos.mockReturnValue({
      data: [],
      isLoading: false,
    });
    setSisuGoal.mockResolvedValue(undefined);
    useSetSisuGoal.mockReturnValue({
      mutateAsync: setSisuGoal,
      isPending: false,
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
    expect(screen.getAllByText("UNI · TS")).toHaveLength(2);
    expect(screen.getByText("Nota de corte: 700 pts")).toBeInTheDocument();
  });

  it("mostra o ranking de cursos da universidade na propria aba de simulados", () => {
    useSisuGoal.mockReturnValue({
      data: {
        sisu_curso_nome: "Direito",
        sisu_universidade: "UFRN",
        sisu_uf: "RN",
        sisu_nota_corte: 710,
      },
      isLoading: false,
    });
    useSisuCursos.mockReturnValue({
      data: [
        { curso: "Medicina", nota_corte: 784 },
        { curso: "Direito", nota_corte: 710 },
      ],
      isLoading: false,
    });

    renderPage(<Simulados />);

    expect(screen.getByText("Ranking de cursos")).toBeInTheDocument();
    expect(screen.getAllByText("UFRN · RN")).toHaveLength(2);
    expect(screen.getByText("Medicina")).toBeInTheDocument();
    expect(screen.getByText("784 pts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Direito, meta atual" })).toBeDisabled();
  });

  it("salva outro curso direto pelo ranking da aba de simulados", async () => {
    useSisuGoal.mockReturnValue({
      data: {
        sisu_curso_nome: "Direito",
        sisu_universidade: "UFRN",
        sisu_uf: "RN",
        sisu_nota_corte: 710,
      },
      isLoading: false,
    });
    useSisuCursos.mockReturnValue({
      data: [
        { curso: "Medicina", nota_corte: 784 },
        { curso: "Direito", nota_corte: 710 },
      ],
      isLoading: false,
    });

    renderPage(<Simulados />);
    fireEvent.click(screen.getByRole("button", { name: /escolher medicina/i }));

    await waitFor(() => {
      expect(setSisuGoal).toHaveBeenCalledWith({
        sigla: "UFRN",
        uf: "RN",
        curso: "Medicina",
      });
    });
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
