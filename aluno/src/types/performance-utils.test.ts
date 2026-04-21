import { describe, expect, it } from "vitest";
import {
  collectAreaTimeSeries,
  computeAreaTrend,
  hasAnyEstimated,
} from "./performance-utils";
import type {
  SimuladoPerformance,
  TriEstimadoFlags,
  TriScores,
} from "./performance";

// Test helper: accepts partial overrides for each field (including nested).
// The defaults below fully populate the structure so overrides can be sparse.
type MkOverrides = Partial<Omit<SimuladoPerformance, "tri" | "tri_estimado">> & {
  readonly tri?: Partial<TriScores>;
  readonly tri_estimado?: Partial<TriEstimadoFlags>;
};

function mk(overrides: MkOverrides = {}): SimuladoPerformance {
  const { tri: triOverride, tri_estimado: estOverride, ...rest } = overrides;
  return {
    fonte: "legacy",
    simulado_id: "sim-x",
    simulado_nome: "Sim X",
    data: "2026-03-01T00:00:00Z",
    formato: "enem_180",
    fez_dia1: true,
    fez_dia2: true,
    acertos: { lc: 30, ch: 30, cn: 30, mt: 30 },
    answers: [],
    tri_total: 600,
    ...rest,
    tri: { lc: 600, ch: 600, cn: 600, mt: 600, ...(triOverride ?? {}) },
    tri_estimado: {
      lc: false,
      ch: false,
      cn: false,
      mt: false,
      ...(estOverride ?? {}),
    },
  };
}

describe("computeAreaTrend", () => {
  it("retorna nulls quando não há performances", () => {
    const r = computeAreaTrend([], "lc");
    expect(r).toEqual({ current: null, previous: null, delta: null });
  });

  it("calcula delta correto com 2 simulados válidos", () => {
    const r = computeAreaTrend(
      [
        mk({ simulado_id: "n", data: "2026-03-01T00:00:00Z", tri: { lc: 650 } }),
        mk({ simulado_id: "o", data: "2026-01-01T00:00:00Z", tri: { lc: 600 } }),
      ],
      "lc",
    );
    expect(r.current).toBe(650);
    expect(r.previous).toBe(600);
    expect(r.delta).toBe(50);
  });

  it("ignora scores estimated (guardrail G3)", () => {
    const r = computeAreaTrend(
      [
        mk({
          simulado_id: "n",
          data: "2026-03-01T00:00:00Z",
          tri: { lc: 320 },
          tri_estimado: { lc: true },
        }),
        mk({ simulado_id: "o", data: "2026-01-01T00:00:00Z", tri: { lc: 600 } }),
      ],
      "lc",
    );
    // Só sobra o older (válido) → current=600, sem previous
    expect(r.current).toBe(600);
    expect(r.previous).toBeNull();
    expect(r.delta).toBeNull();
  });

  it("ignora scores zero", () => {
    const r = computeAreaTrend(
      [
        mk({ simulado_id: "n", data: "2026-03-01T00:00:00Z", tri: { lc: 0 } }),
        mk({ simulado_id: "o", data: "2026-01-01T00:00:00Z", tri: { lc: 600 } }),
      ],
      "lc",
    );
    expect(r.current).toBe(600);
  });

  it("delta negativo quando TRI caiu", () => {
    const r = computeAreaTrend(
      [
        mk({ simulado_id: "n", data: "2026-03-01T00:00:00Z", tri: { lc: 500 } }),
        mk({ simulado_id: "o", data: "2026-01-01T00:00:00Z", tri: { lc: 600 } }),
      ],
      "lc",
    );
    expect(r.delta).toBe(-100);
  });
});

describe("collectAreaTimeSeries", () => {
  it("retorna scores em ordem cronológica (old → new)", () => {
    const series = collectAreaTimeSeries(
      [
        mk({ simulado_id: "c", data: "2026-05-01T00:00:00Z", tri: { lc: 700 } }),
        mk({ simulado_id: "a", data: "2026-01-01T00:00:00Z", tri: { lc: 500 } }),
        mk({ simulado_id: "b", data: "2026-03-01T00:00:00Z", tri: { lc: 600 } }),
      ],
      "lc",
    );
    expect(series).toEqual([500, 600, 700]);
  });

  it("filtra estimated e zero", () => {
    const series = collectAreaTimeSeries(
      [
        mk({
          simulado_id: "a",
          data: "2026-01-01T00:00:00Z",
          tri: { lc: 500 },
          tri_estimado: { lc: true },
        }),
        mk({ simulado_id: "b", data: "2026-02-01T00:00:00Z", tri: { lc: 0 } }),
        mk({ simulado_id: "c", data: "2026-03-01T00:00:00Z", tri: { lc: 650 } }),
      ],
      "lc",
    );
    expect(series).toEqual([650]);
  });
});

describe("hasAnyEstimated", () => {
  it("true quando qualquer área está estimated", () => {
    expect(hasAnyEstimated(mk({ tri_estimado: { cn: true } }))).toBe(true);
  });

  it("false quando nenhuma está estimated", () => {
    expect(hasAnyEstimated(mk())).toBe(false);
  });

  it("true quando múltiplas áreas estão estimated", () => {
    expect(
      hasAnyEstimated(mk({ tri_estimado: { lc: true, ch: true } })),
    ).toBe(true);
  });
});
