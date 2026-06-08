import { describe, expect, it } from "vitest";
import { byDifficultyAsc, difficultyTier } from "./question-difficulty";

describe("difficultyTier", () => {
  it("classifica pelos cortes b<0.5 / 0.5–1.5 / >=1.5", () => {
    expect(difficultyTier(-0.5)).toBe("facil");
    expect(difficultyTier(0)).toBe("facil");
    expect(difficultyTier(0.49)).toBe("facil");
    expect(difficultyTier(0.5)).toBe("medio");
    expect(difficultyTier(1.49)).toBe("medio");
    expect(difficultyTier(1.5)).toBe("dificil");
    expect(difficultyTier(2.5)).toBe("dificil");
  });

  it("aceita string (formato do JSON) e trata ausente/inválido como null", () => {
    expect(difficultyTier("0.5")).toBe("medio");
    expect(difficultyTier("-0.54366")).toBe("facil");
    expect(difficultyTier(null)).toBeNull();
    expect(difficultyTier(undefined)).toBeNull();
    expect(difficultyTier("")).toBeNull();
    expect(difficultyTier("abc")).toBeNull();
  });
});

describe("byDifficultyAsc", () => {
  it("ordena fácil → difícil, com dificuldade ausente no fim", () => {
    const ordered = [
      { id: "c", dificuldade: 2.5 },
      { id: "a", dificuldade: -0.5 },
      { id: "x", dificuldade: null },
      { id: "b", dificuldade: "0.5" },
    ]
      .sort(byDifficultyAsc)
      .map((q) => q.id);
    expect(ordered).toEqual(["a", "b", "c", "x"]);
  });
});
