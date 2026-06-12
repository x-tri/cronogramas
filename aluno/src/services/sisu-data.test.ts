import { describe, it, expect } from "vitest";
import {
  buildUniversidadeFromCortes,
  type SisuCorteRow,
} from "./sisu-data";

const row = (
  curso: string,
  nota_corte: number,
  ano: number,
): SisuCorteRow => ({
  sigla: "UFRN",
  nome: "Universidade Federal do Rio Grande do Norte",
  uf: "RN",
  curso,
  nota_corte,
  ano,
});

describe("buildUniversidadeFromCortes", () => {
  it("retorna null sem linhas", () => {
    expect(buildUniversidadeFromCortes([])).toBeNull();
  });

  it("usa o ano mais recente por curso e ordena por corte desc", () => {
    const result = buildUniversidadeFromCortes([
      row("Medicina", 784, 2025),
      row("Direito", 706.1, 2026),
      row("Direito", 692.9, 2025),
    ]);
    expect(result).not.toBeNull();
    expect(result!.universidade.sigla).toBe("UFRN");
    expect(result!.universidade.cursos.map((c) => c.curso)).toEqual([
      "Medicina",
      "Direito",
    ]);
    // Direito usa 2026 (706), não 2025 (693)
    expect(result!.universidade.cursos[1].notaCorte).toBe(706);
    expect(result!.ano).toBe(2026);
  });

  it("atribui emoji por heurística com fallback 🎓", () => {
    const result = buildUniversidadeFromCortes([
      row("Medicina", 784, 2025),
      row("Museologia", 623, 2025),
    ]);
    const cursos = result!.universidade.cursos;
    expect(cursos.find((c) => c.curso === "Medicina")!.emoji).toBe("🩺");
    expect(cursos.find((c) => c.curso === "Museologia")!.emoji).toBe("🎓");
  });
});
