import { describe, it, expect } from "vitest";

import {
  filtrarPorTurma,
  histogramaNotas,
  mediaAcertosPorArea,
  mediaTriSimples,
  rankRespostas,
  statsGrupo,
  topicosErradosTurma,
  totalAcertos,
  turmasPresentes,
  type RankingResposta,
} from "./ranking-aggregations";

function makeResposta(overrides: Partial<RankingResposta> = {}): RankingResposta {
  return {
    id: "r-1",
    student_id: "s-1",
    student_name: "Aluno Teste",
    student_turma: "3A",
    tri_lc: 500,
    tri_ch: 500,
    tri_cn: 500,
    tri_mt: 500,
    acertos_lc: 20,
    acertos_ch: 20,
    acertos_cn: 20,
    acertos_mt: 20,
    erros_por_topico: {},
    submitted_at: "2026-04-18T10:00:00Z",
    ...overrides,
  };
}

describe("mediaTriSimples", () => {
  it("calcula média das 4 áreas", () => {
    const r = makeResposta({ tri_lc: 400, tri_ch: 500, tri_cn: 600, tri_mt: 700 });
    expect(mediaTriSimples(r)).toBe(550);
  });

  it("retorna null se qualquer área é null", () => {
    expect(mediaTriSimples(makeResposta({ tri_lc: null }))).toBeNull();
    expect(mediaTriSimples(makeResposta({ tri_mt: null }))).toBeNull();
  });
});

describe("totalAcertos", () => {
  it("soma acertos das 4 áreas", () => {
    const r = makeResposta({
      acertos_lc: 10,
      acertos_ch: 20,
      acertos_cn: 30,
      acertos_mt: 40,
    });
    expect(totalAcertos(r)).toBe(100);
  });
});

describe("rankRespostas", () => {
  it("ordena por média desc + atribui posição 1-indexed", () => {
    const r1 = makeResposta({ id: "r1", tri_lc: 400, tri_ch: 400, tri_cn: 400, tri_mt: 400 }); // média 400
    const r2 = makeResposta({ id: "r2", tri_lc: 800, tri_ch: 800, tri_cn: 800, tri_mt: 800 }); // média 800
    const r3 = makeResposta({ id: "r3", tri_lc: 600, tri_ch: 600, tri_cn: 600, tri_mt: 600 }); // média 600

    const ranked = rankRespostas([r1, r2, r3]);
    expect(ranked.map((r) => r.resposta.id)).toEqual(["r2", "r3", "r1"]);
    expect(ranked.map((r) => r.posicao)).toEqual([1, 2, 3]);
    expect(ranked[0]!.mediaTri).toBe(800);
  });

  it("calcula diff em relação à média do grupo", () => {
    const r1 = makeResposta({ id: "r1", tri_lc: 400, tri_ch: 400, tri_cn: 400, tri_mt: 400 });
    const r2 = makeResposta({ id: "r2", tri_lc: 600, tri_ch: 600, tri_cn: 600, tri_mt: 600 });
    const ranked = rankRespostas([r1, r2]);
    // média grupo = 500
    expect(ranked[0]!.diffTurma).toBe(100); // 600 - 500
    expect(ranked[1]!.diffTurma).toBe(-100);
  });

  it("respostas com média null vão para o fim", () => {
    const r1 = makeResposta({ id: "r1", tri_lc: null });
    const r2 = makeResposta({ id: "r2", tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500 });
    const ranked = rankRespostas([r1, r2]);
    expect(ranked[0]!.resposta.id).toBe("r2");
    expect(ranked[1]!.resposta.id).toBe("r1");
    expect(ranked[1]!.mediaTri).toBeNull();
  });

  it("array vazio retorna array vazio", () => {
    expect(rankRespostas([])).toEqual([]);
  });
});

describe("statsGrupo", () => {
  it("calcula count, média, desvio, melhor, pior", () => {
    const respostas = [
      makeResposta({ tri_lc: 400, tri_ch: 400, tri_cn: 400, tri_mt: 400 }), // 400
      makeResposta({ tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500 }), // 500
      makeResposta({ tri_lc: 600, tri_ch: 600, tri_cn: 600, tri_mt: 600 }), // 600
    ];
    const stats = statsGrupo(respostas);
    expect(stats.count).toBe(3);
    expect(stats.media).toBe(500);
    expect(stats.melhor).toBe(600);
    expect(stats.pior).toBe(400);
    expect(stats.desvio).toBeCloseTo(81.65, 1); // sqrt(((100)^2*2)/3)
  });

  it("retorna nulls quando não há respostas válidas", () => {
    const stats = statsGrupo([]);
    expect(stats.count).toBe(0);
    expect(stats.media).toBeNull();
    expect(stats.desvio).toBeNull();
    expect(stats.melhor).toBeNull();
    expect(stats.pior).toBeNull();
  });
});

describe("topicosErradosTurma", () => {
  it("agrega tópicos de múltiplos alunos e ordena por totalErros desc", () => {
    const respostas = [
      makeResposta({
        id: "r1",
        student_id: "s1",
        erros_por_topico: { "Funções": 3, "História Geral": 2 },
      }),
      makeResposta({
        id: "r2",
        student_id: "s2",
        erros_por_topico: { "Funções": 5, "Ecologia": 4 },
      }),
    ];
    const top = topicosErradosTurma(respostas, 10);
    expect(top).toHaveLength(3);
    expect(top[0]).toEqual({
      topico: "Funções",
      totalErros: 8,
      alunosAfetados: 2,
    });
    expect(top[1]!.topico).toBe("Ecologia");
    expect(top[2]!.topico).toBe("História Geral");
  });

  it("limita ao N pedido", () => {
    const respostas = [
      makeResposta({
        erros_por_topico: { A: 10, B: 9, C: 8, D: 7, E: 6, F: 5, G: 4 },
      }),
    ];
    expect(topicosErradosTurma(respostas, 3)).toHaveLength(3);
  });

  it("ignora tópicos vazios ou com n inválido", () => {
    const respostas = [
      makeResposta({
        erros_por_topico: { "": 5, "Válido": 2, "   ": 1 },
      }),
    ];
    const top = topicosErradosTurma(respostas);
    expect(top).toHaveLength(1);
    expect(top[0]!.topico).toBe("Válido");
  });

  it("array vazio retorna array vazio", () => {
    expect(topicosErradosTurma([])).toEqual([]);
  });
});

describe("mediaAcertosPorArea", () => {
  it("calcula média por área da turma", () => {
    const respostas = [
      makeResposta({ acertos_lc: 10, acertos_ch: 20, acertos_cn: 30, acertos_mt: 40 }),
      makeResposta({ acertos_lc: 20, acertos_ch: 30, acertos_cn: 40, acertos_mt: 10 }),
    ];
    const medias = mediaAcertosPorArea(respostas);
    expect(medias.LC).toBe(15);
    expect(medias.CH).toBe(25);
    expect(medias.CN).toBe(35);
    expect(medias.MT).toBe(25);
  });

  it("zeros quando array vazio", () => {
    expect(mediaAcertosPorArea([])).toEqual({ LC: 0, CH: 0, CN: 0, MT: 0 });
  });
});

describe("histogramaNotas", () => {
  it("distribui em bins de 50 por default", () => {
    const respostas = [
      makeResposta({ tri_lc: 420, tri_ch: 420, tri_cn: 420, tri_mt: 420 }), // média 420 -> bin [400, 450)
      makeResposta({ tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500 }), // 500 -> bin [500, 550)
      makeResposta({ tri_lc: 510, tri_ch: 510, tri_cn: 510, tri_mt: 510 }), // 510 -> bin [500, 550)
    ];
    const bins = histogramaNotas(respostas);
    // 200-250, 250-300, ..., 950-1000 = 16 bins
    expect(bins).toHaveLength(16);
    const bin420 = bins.find((b) => b.min === 400);
    const bin500 = bins.find((b) => b.min === 500);
    expect(bin420?.count).toBe(1);
    expect(bin500?.count).toBe(2);
  });
});

describe("turmasPresentes + filtrarPorTurma", () => {
  it("lista turmas distintas sorted asc", () => {
    const respostas = [
      makeResposta({ student_turma: "3B" }),
      makeResposta({ student_turma: "3A" }),
      makeResposta({ student_turma: "3A" }),
      makeResposta({ student_turma: null }),
    ];
    expect(turmasPresentes(respostas)).toEqual(["3A", "3B"]);
  });

  it("filtra por turma específica", () => {
    const respostas = [
      makeResposta({ id: "a", student_turma: "3A" }),
      makeResposta({ id: "b", student_turma: "3B" }),
    ];
    const filtered = filtrarPorTurma(respostas, "3A");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("a");
  });

  it("turma vazia retorna todas", () => {
    const respostas = [
      makeResposta({ student_turma: "3A" }),
      makeResposta({ student_turma: "3B" }),
    ];
    expect(filtrarPorTurma(respostas, "")).toHaveLength(2);
  });
});
