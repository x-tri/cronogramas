import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { format } from "date-fns";

import { ActivityHeatmapCard } from "./ActivityHeatmapCard";

vi.mock("@/hooks/useStudentData", () => ({ useAllBlocos: vi.fn() }));
vi.mock("@/hooks/useStudentPerformance", () => ({ useStudentPerformance: vi.fn() }));
vi.mock("@/hooks/useGamification", () => ({ useGamification: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useAllBlocos } = (await import("@/hooks/useStudentData")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useStudentPerformance } = (await import("@/hooks/useStudentPerformance")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { useGamification } = (await import("@/hooks/useGamification")) as any;

const student = { id: "s1", matricula: "2026001", name: "Maria Silva", turma: "3A" };

function setHooks(opts: {
  blocos?: unknown[];
  cronogramas?: unknown[];
  performances?: unknown[];
  xp?: number;
  loading?: boolean;
}) {
  useAllBlocos.mockReturnValue({
    data: { blocos: opts.blocos ?? [], cronogramas: opts.cronogramas ?? [] },
    isLoading: opts.loading ?? false,
  });
  useStudentPerformance.mockReturnValue({ data: { performances: opts.performances ?? [] } });
  useGamification.mockReturnValue({ data: { xp_total: opts.xp ?? 0 } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActivityHeatmapCard", () => {
  it("renders the student header and the four stat labels", () => {
    setHooks({ xp: 120 });
    render(<ActivityHeatmapCard student={student} />);

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Turma 3A")).toBeInTheDocument();
    expect(screen.getByText("XP total")).toBeInTheDocument();
    expect(screen.getByText("dias ativos")).toBeInTheDocument();
    expect(screen.getByText("dias seguidos")).toBeInTheDocument();
    expect(screen.getByText("recorde de dias")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("explains what the squares mean for first-time students", () => {
    setHooks({ xp: 10 });
    render(<ActivityHeatmapCard student={student} />);

    expect(screen.getByText(/cada quadradinho é um dia/i)).toBeInTheDocument();
  });

  it("paints a heatmap cell for a day with activity", () => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    setHooks({ performances: [{ data: todayKey }], xp: 50 });
    render(<ActivityHeatmapCard student={student} />);

    // Today's cell exposes a tooltip via its title attribute.
    expect(screen.getByTitle(/1 atividade ·/)).toBeInTheDocument();
  });

  it("shows the empty-state hint when there is no activity", () => {
    setHooks({});
    render(<ActivityHeatmapCard student={student} />);

    expect(screen.getByText(/preencher seu mapa/)).toBeInTheDocument();
  });

  it("renders a skeleton while blocos are loading", () => {
    setHooks({ loading: true });
    const { container } = render(<ActivityHeatmapCard student={student} />);

    expect(screen.queryByText("XP total")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders nothing without a student", () => {
    setHooks({});
    const { container } = render(<ActivityHeatmapCard student={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
