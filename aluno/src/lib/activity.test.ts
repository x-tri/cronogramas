import { describe, it, expect } from "vitest";

import {
  buildDailyActivity,
  computeActiveDays,
  computeStreaks,
  buildHeatmapWeeks,
  type DailyActivity,
} from "./activity";

function daily(entries: Record<string, number>): DailyActivity {
  return new Map(Object.entries(entries));
}

describe("buildDailyActivity", () => {
  const cronogramas = [{ id: "c1", semana_inicio: "2026-05-04" }]; // week starting Monday

  it("maps a completed bloco to its scheduled day (segunda = semana_inicio)", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [{ cronograma_id: "c1", dia_semana: "segunda", concluido: true }],
      simulados: [],
    });
    expect(result.get("2026-05-04")).toBe(1);
  });

  it("applies the weekday offset (quarta = semana_inicio + 2)", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [{ cronograma_id: "c1", dia_semana: "quarta", concluido: true }],
      simulados: [],
    });
    expect(result.get("2026-05-06")).toBe(1);
  });

  it("ignores blocos that are not concluido", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [
        { cronograma_id: "c1", dia_semana: "segunda", concluido: false },
        { cronograma_id: "c1", dia_semana: "terca", concluido: null },
      ],
      simulados: [],
    });
    expect(result.size).toBe(0);
  });

  it("ignores blocos whose cronograma is unknown", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [{ cronograma_id: "ghost", dia_semana: "segunda", concluido: true }],
      simulados: [],
    });
    expect(result.size).toBe(0);
  });

  it("ignores blocos with an unknown dia_semana", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [{ cronograma_id: "c1", dia_semana: "feriado", concluido: true }],
      simulados: [],
    });
    expect(result.size).toBe(0);
  });

  it("sums multiple completed blocos on the same day", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [
        { cronograma_id: "c1", dia_semana: "segunda", concluido: true },
        { cronograma_id: "c1", dia_semana: "segunda", concluido: true },
      ],
      simulados: [],
    });
    expect(result.get("2026-05-04")).toBe(2);
  });

  it("counts simulados by their date (date-only and datetime)", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [],
      simulados: [{ data: "2026-05-10" }, { data: "2026-05-11T13:45:00Z" }],
    });
    expect(result.get("2026-05-10")).toBe(1);
    expect(result.get("2026-05-11")).toBe(1);
  });

  it("combines blocos and simulados that fall on the same day", () => {
    const result = buildDailyActivity({
      cronogramas,
      blocos: [{ cronograma_id: "c1", dia_semana: "segunda", concluido: true }],
      simulados: [{ data: "2026-05-04" }],
    });
    expect(result.get("2026-05-04")).toBe(2);
  });
});

describe("computeActiveDays", () => {
  it("returns 0 for an empty map", () => {
    expect(computeActiveDays(daily({}))).toBe(0);
  });

  it("counts how many days have activity", () => {
    expect(computeActiveDays(daily({ "2026-05-01": 1, "2026-05-02": 3, "2026-05-03": 2 }))).toBe(3);
  });

  it("ignores days with zero activity", () => {
    expect(computeActiveDays(daily({ "2026-05-01": 1, "2026-05-02": 0, "2026-05-03": 2 }))).toBe(2);
  });
});

describe("computeStreaks", () => {
  const today = new Date(2026, 4, 20); // 2026-05-20 (local)

  it("returns zeros for an empty map", () => {
    expect(computeStreaks(daily({}), today)).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive active days ending today", () => {
    const map = daily({ "2026-05-18": 1, "2026-05-19": 2, "2026-05-20": 1 });
    expect(computeStreaks(map, today).current).toBe(3);
  });

  it("keeps the current streak alive when today has no activity yet but yesterday does", () => {
    const map = daily({ "2026-05-18": 1, "2026-05-19": 1 });
    expect(computeStreaks(map, today).current).toBe(2);
  });

  it("breaks the current streak on a gap", () => {
    const map = daily({ "2026-05-18": 1, "2026-05-20": 1 }); // 05-19 missing
    expect(computeStreaks(map, today).current).toBe(1);
  });

  it("returns 0 current when neither today nor yesterday is active", () => {
    const map = daily({ "2026-05-17": 1 });
    expect(computeStreaks(map, today).current).toBe(0);
  });

  it("finds the longest run anywhere in history", () => {
    const map = daily({
      "2026-05-01": 1,
      "2026-05-02": 1,
      "2026-05-03": 1, // run of 3
      "2026-05-10": 1, // run of 1
      "2026-05-12": 1,
      "2026-05-13": 1, // run of 2
    });
    expect(computeStreaks(map, today).longest).toBe(3);
  });
});

describe("buildHeatmapWeeks", () => {
  const today = new Date(2026, 4, 20); // wednesday 2026-05-20

  it("returns `weeks` columns of 7 days each", () => {
    const grid = buildHeatmapWeeks(daily({}), { weeks: 4, today });
    expect(grid).toHaveLength(4);
    for (const col of grid) expect(col).toHaveLength(7);
  });

  it("places today in the last column", () => {
    const grid = buildHeatmapWeeks(daily({}), { weeks: 4, today });
    const lastColDates = grid[grid.length - 1].map((c) => c.date);
    expect(lastColDates).toContain("2026-05-20");
  });

  it("maps counts and shading levels onto the matching cell", () => {
    const grid = buildHeatmapWeeks(daily({ "2026-05-20": 4 }), { weeks: 4, today });
    const cell = grid.flat().find((c) => c.date === "2026-05-20");
    expect(cell?.count).toBe(4);
    expect(cell?.level).toBe(3); // 3-4 -> level 3
  });

  it("flags days after today as future and today as not future", () => {
    const grid = buildHeatmapWeeks(daily({}), { weeks: 4, today });
    const flat = grid.flat();
    expect(flat.find((c) => c.date === "2026-05-20")?.isFuture).toBe(false);
    expect(flat.find((c) => c.date === "2026-05-21")?.isFuture).toBe(true);
  });

  it("assigns escalating levels by count", () => {
    const grid = buildHeatmapWeeks(
      daily({ "2026-05-18": 1, "2026-05-19": 2, "2026-05-20": 7 }),
      { weeks: 4, today },
    );
    const byDate = (d: string) => grid.flat().find((c) => c.date === d);
    expect(byDate("2026-05-18")?.level).toBe(1);
    expect(byDate("2026-05-19")?.level).toBe(2);
    expect(byDate("2026-05-20")?.level).toBe(4); // >=5 -> level 4
  });
});
