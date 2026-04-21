import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import HistoricoSimulados from "./HistoricoSimulados";

// Mock hooks before importing component
vi.mock("@/hooks/useStudentData", () => ({
  useStudentProfile: vi.fn(),
}));
vi.mock("@/hooks/useStudentPerformance", () => ({
  useStudentPerformance: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useStudentProfile } = (await import("@/hooks/useStudentData")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useStudentPerformance } = (await import("@/hooks/useStudentPerformance")) as any;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HistoricoSimulados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra skeleton enquanto carrega", () => {
    useStudentProfile.mockReturnValue({ data: null, isLoading: true });
    useStudentPerformance.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
    const { container } = wrap(<HistoricoSimulados />);
    expect(container.querySelector(".animate-pulse, [class*='Skeleton']")).not.toBeNull();
  });

  it("mostra mensagem de erro quando a chamada falha", () => {
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", matricula: "12345" },
      isLoading: false,
    });
    useStudentPerformance.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Falha rede"),
    });
    wrap(<HistoricoSimulados />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Falha rede/i);
  });

  it("mostra estado vazio quando não há simulados", () => {
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", matricula: "12345" },
      isLoading: false,
    });
    useStudentPerformance.mockReturnValue({
      data: {
        student_id: "stu-1",
        matricula: "12345",
        school_id: "sch-1",
        performances: [],
        fontes_utilizadas: [],
        legacy_status: "ok",
        cronogramas_status: "ok",
        fetched_at: "2026-04-21T00:00:00Z",
      },
      isLoading: false,
      error: null,
    });
    wrap(<HistoricoSimulados />);
    expect(screen.getByText(/Nenhum simulado registrado/i)).toBeInTheDocument();
  });

  it("renderiza cards por área com scores corretos", () => {
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", matricula: "12345" },
      isLoading: false,
    });
    useStudentPerformance.mockReturnValue({
      data: {
        student_id: "stu-1",
        matricula: "12345",
        school_id: "sch-1",
        fontes_utilizadas: ["legacy"],
        legacy_status: "ok",
        cronogramas_status: "ok",
        fetched_at: "2026-04-21T00:00:00Z",
        performances: [
          {
            fonte: "legacy",
            simulado_id: "sim-1",
            simulado_nome: "Simulado Literato 1",
            data: "2026-03-01T00:00:00Z",
            formato: "enem_180",
            fez_dia1: true,
            fez_dia2: true,
            tri: { lc: 650, ch: 600, cn: 580, mt: 700 },
            tri_estimado: { lc: false, ch: false, cn: false, mt: false },
            acertos: { lc: 30, ch: 28, cn: 22, mt: 35 },
            answers: [],
            tri_total: 632.5,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    wrap(<HistoricoSimulados />);
    // Score LC 650 aparece no card
    const lcCard = screen.getByTestId("area-card-lc");
    expect(lcCard).toHaveTextContent("650");
    const mtCard = screen.getByTestId("area-card-mt");
    expect(mtCard).toHaveTextContent("700");
    // Simulado na lista
    expect(screen.getByText(/Simulado Literato 1/i)).toBeInTheDocument();
  });

  it("mostra flag de score estimado quando aluno não fez dia 2", () => {
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", matricula: "12345" },
      isLoading: false,
    });
    useStudentPerformance.mockReturnValue({
      data: {
        student_id: "stu-1",
        matricula: "12345",
        school_id: "sch-1",
        fontes_utilizadas: ["legacy"],
        legacy_status: "ok",
        cronogramas_status: "ok",
        fetched_at: "2026-04-21T00:00:00Z",
        performances: [
          {
            fonte: "legacy",
            simulado_id: "sim-1",
            simulado_nome: "Simulado Incompleto",
            data: "2026-03-01T00:00:00Z",
            formato: "enem_180",
            fez_dia1: true,
            fez_dia2: false,
            tri: { lc: 600, ch: 580, cn: 310, mt: 320 },
            tri_estimado: { lc: false, ch: false, cn: true, mt: true },
            acertos: { lc: 30, ch: 28, cn: 0, mt: 0 },
            answers: [],
            tri_total: 452.5,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    wrap(<HistoricoSimulados />);
    // Warning visible
    expect(
      screen.getByText(/Algumas áreas têm score estimado/i),
    ).toBeInTheDocument();
  });

  it("mostra delta positivo quando TRI subiu entre dois simulados", () => {
    useStudentProfile.mockReturnValue({
      data: { id: "stu-1", matricula: "12345" },
      isLoading: false,
    });
    useStudentPerformance.mockReturnValue({
      data: {
        student_id: "stu-1",
        matricula: "12345",
        school_id: "sch-1",
        fontes_utilizadas: ["legacy"],
        legacy_status: "ok",
        cronogramas_status: "ok",
        fetched_at: "2026-04-21T00:00:00Z",
        performances: [
          {
            fonte: "legacy",
            simulado_id: "sim-novo",
            simulado_nome: "Novo",
            data: "2026-03-01T00:00:00Z",
            formato: "enem_180",
            fez_dia1: true,
            fez_dia2: true,
            tri: { lc: 700, ch: 700, cn: 700, mt: 700 },
            tri_estimado: { lc: false, ch: false, cn: false, mt: false },
            acertos: { lc: 35, ch: 35, cn: 35, mt: 35 },
            answers: [],
            tri_total: 700,
          },
          {
            fonte: "legacy",
            simulado_id: "sim-velho",
            simulado_nome: "Velho",
            data: "2026-01-01T00:00:00Z",
            formato: "enem_180",
            fez_dia1: true,
            fez_dia2: true,
            tri: { lc: 600, ch: 600, cn: 600, mt: 600 },
            tri_estimado: { lc: false, ch: false, cn: false, mt: false },
            acertos: { lc: 30, ch: 30, cn: 30, mt: 30 },
            answers: [],
            tri_total: 600,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    wrap(<HistoricoSimulados />);
    const lcCard = screen.getByTestId("area-card-lc");
    // Delta +100 esperado (700 - 600)
    expect(lcCard).toHaveTextContent(/\+100/);
  });
});
