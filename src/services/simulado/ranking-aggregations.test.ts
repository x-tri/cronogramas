import { describe, it, expect } from "vitest";

import {
  areaDoTopico,
  extrairMateriaRaiz,
  filtrarPorTurma,
  histogramaNotas,
  mediaAcertosPorArea,
  mediaTriSimples,
  rankRespostas,
  statsGrupo,
  topErrosPorArea,
  topicoMaisErradoPorArea,
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
  it("calcula média das 4 áreas quando todas submetidas", () => {
    const r = makeResposta({ tri_lc: 400, tri_ch: 500, tri_cn: 600, tri_mt: 700 });
    expect(mediaTriSimples(r)).toBe(550);
  });

  it("calcula média parcial ignorando áreas não submetidas (null)", () => {
    // Aluno só submeteu LC e MT — média deve ser dos 2, não null
    const r = makeResposta({ tri_lc: 400, tri_ch: null, tri_cn: null, tri_mt: 600 });
    expect(mediaTriSimples(r)).toBe(500);
  });

  it("calcula média de 1 área só (entrega super parcial)", () => {
    const r = makeResposta({ tri_lc: 750, tri_ch: null, tri_cn: null, tri_mt: null });
    expect(mediaTriSimples(r)).toBe(750);
  });

  it("retorna null SÓ se NENHUMA área foi submetida", () => {
    const r = makeResposta({ tri_lc: null, tri_ch: null, tri_cn: null, tri_mt: null });
    expect(mediaTriSimples(r)).toBeNull();
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

  it("respostas SEM nenhuma área submetida vão para o fim", () => {
    // Só a r1 com TODAS áreas null fica null e vai pro fim
    const r1 = makeResposta({ id: "r1", tri_lc: null, tri_ch: null, tri_cn: null, tri_mt: null });
    const r2 = makeResposta({ id: "r2", tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500 });
    const ranked = rankRespostas([r1, r2]);
    expect(ranked[0]!.resposta.id).toBe("r2");
    expect(ranked[1]!.resposta.id).toBe("r1");
    expect(ranked[1]!.mediaTri).toBeNull();
  });

  it("respostas parciais entram no ranking com a média das áreas submetidas", () => {
    // r1 só LC=800 → média 800
    // r2 todas 500 → média 500
    // r1 deve ficar EM PRIMEIRO mesmo sendo parcial
    const r1 = makeResposta({ id: "r1", tri_lc: 800, tri_ch: null, tri_cn: null, tri_mt: null });
    const r2 = makeResposta({ id: "r2", tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500 });
    const ranked = rankRespostas([r1, r2]);
    expect(ranked[0]!.resposta.id).toBe("r1");
    expect(ranked[0]!.mediaTri).toBe(800);
    expect(ranked[1]!.resposta.id).toBe("r2");
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

  it("ignora alunos que não submeteram a área (tri_xx == null)", () => {
    // Aluno A só submeteu MT (40 acertos), outras áreas tri null mas acertos=0
    // Aluno B submeteu tudo
    // Média MT deve ser (40+30)/2 = 35, não (40+30)/2
    // Média LC deve usar SÓ o B (não somar 0 do A) = 20
    const respostas = [
      makeResposta({
        tri_lc: null, tri_ch: null, tri_cn: null, tri_mt: 700,
        acertos_lc: 0, acertos_ch: 0, acertos_cn: 0, acertos_mt: 40,
      }),
      makeResposta({
        tri_lc: 500, tri_ch: 500, tri_cn: 500, tri_mt: 500,
        acertos_lc: 20, acertos_ch: 20, acertos_cn: 20, acertos_mt: 30,
      }),
    ];
    const medias = mediaAcertosPorArea(respostas);
    expect(medias.LC).toBe(20); // só o aluno B
    expect(medias.CH).toBe(20); // só o aluno B
    expect(medias.CN).toBe(20); // só o aluno B
    expect(medias.MT).toBe(35); // ambos (40+30)/2
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

describe("extrairMateriaRaiz", () => {
  it("retorna a matéria antes do primeiro hífen", () => {
    expect(extrairMateriaRaiz("Geografia - Fusos horários")).toBe("Geografia");
  });

  it("retorna a matéria antes da primeira barra", () => {
    expect(extrairMateriaRaiz("Matemática/Probabilidade - Eventos")).toBe("Matemática");
    expect(extrairMateriaRaiz("Sociologia/Política - Estado de direito")).toBe("Sociologia");
  });

  it("quando tem barra antes do hífen usa a barra", () => {
    expect(extrairMateriaRaiz("Química/Soluções - Precipitação")).toBe("Química");
  });

  it("retorna tópico inteiro se não tem separador", () => {
    expect(extrairMateriaRaiz("Matemática")).toBe("Matemática");
  });

  it("trim espaços", () => {
    expect(extrairMateriaRaiz("  Geografia - Algo  ")).toBe("Geografia");
  });
});

describe("areaDoTopico", () => {
  it("classifica matérias LC", () => {
    expect(areaDoTopico("Literatura - Cordel")).toBe("LC");
    expect(areaDoTopico("Arte - Escultura")).toBe("LC");
    expect(areaDoTopico("Língua Portuguesa - Variação")).toBe("LC");
    expect(areaDoTopico("Inglês - Leitura")).toBe("LC");
    expect(areaDoTopico("Educação Física - Esportes")).toBe("LC");
  });

  it("classifica matérias CH", () => {
    expect(areaDoTopico("Geografia - Fusos")).toBe("CH");
    expect(areaDoTopico("História - Reforma")).toBe("CH");
    expect(areaDoTopico("Sociologia - Movimentos")).toBe("CH");
    expect(areaDoTopico("Filosofia - Estoicismo")).toBe("CH");
    expect(areaDoTopico("Geopolítica - Venezuela")).toBe("CH");
    expect(areaDoTopico("História do Brasil - Revolta")).toBe("CH");
  });

  it("classifica matérias CN", () => {
    expect(areaDoTopico("Biologia/Ecologia - Impacto")).toBe("CN");
    expect(areaDoTopico("Química/Soluções - Precipitação")).toBe("CN");
    expect(areaDoTopico("Física/Cinemática - MUV")).toBe("CN");
    expect(areaDoTopico("Química Orgânica - IUPAC")).toBe("CN");
  });

  it("classifica matérias MT", () => {
    expect(areaDoTopico("Matemática/Probabilidade - Eventos")).toBe("MT");
    expect(areaDoTopico("Geometria plana - Triângulos")).toBe("MT");
    expect(areaDoTopico("Geometria espacial - Cubo")).toBe("MT");
    expect(areaDoTopico("Análise combinatória - Permutação")).toBe("MT");
    expect(areaDoTopico("Trigonometria - Seno")).toBe("MT");
  });

  it("retorna null para matéria desconhecida", () => {
    expect(areaDoTopico("Astrologia - Horóscopo")).toBeNull();
    expect(areaDoTopico("XYZ - Coisa")).toBeNull();
  });
});

describe("topicoMaisErradoPorArea", () => {
  it("retorna o tópico mais errado em cada uma das 4 áreas", () => {
    const respostas = [
      makeResposta({
        id: "r1",
        student_id: "s1",
        erros_por_topico: {
          "Geografia - Fusos": 3, // CH → 3
          "Sociologia - Cultura": 1, // CH → 1
          "Literatura - Poesia": 2, // LC → 2
          "Matemática - Funções": 4, // MT → 4
          "Biologia - Ecologia": 5, // CN → 5
        },
      }),
      makeResposta({
        id: "r2",
        student_id: "s2",
        erros_por_topico: {
          "Geografia - Fusos": 2, // CH → 3+2=5 (wins CH)
          "Arte - Escultura": 3, // LC → 3 (wins LC)
          "Química - Soluções": 1, // CN → 1
        },
      }),
    ];

    const top = topicoMaisErradoPorArea(respostas);
    expect(top.CH?.topico).toBe("Geografia - Fusos");
    expect(top.CH?.totalErros).toBe(5);
    expect(top.CH?.alunosAfetados).toBe(2);

    expect(top.LC?.topico).toBe("Arte - Escultura");
    expect(top.LC?.totalErros).toBe(3);

    expect(top.CN?.topico).toBe("Biologia - Ecologia");
    expect(top.CN?.totalErros).toBe(5);

    expect(top.MT?.topico).toBe("Matemática - Funções");
    expect(top.MT?.totalErros).toBe(4);
  });

  it("retorna null em áreas sem erros registrados", () => {
    const respostas = [
      makeResposta({
        erros_por_topico: { "Matemática - Funções": 3 },
      }),
    ];
    const top = topicoMaisErradoPorArea(respostas);
    expect(top.LC).toBeNull();
    expect(top.CH).toBeNull();
    expect(top.CN).toBeNull();
    expect(top.MT?.topico).toBe("Matemática - Funções");
  });

  it("ignora tópicos com matéria desconhecida", () => {
    const respostas = [
      makeResposta({
        erros_por_topico: {
          "Astrologia - Horóscopo": 10,
          "Geografia - Clima": 1,
        },
      }),
    ];
    const top = topicoMaisErradoPorArea(respostas);
    expect(top.CH?.topico).toBe("Geografia - Clima");
  });

  it("array vazio retorna todas áreas null", () => {
    const top = topicoMaisErradoPorArea([]);
    expect(top).toEqual({ LC: null, CH: null, CN: null, MT: null });
  });
});

describe("topErrosPorArea", () => {
  it("retorna top 5 por area, sorted desc por erros", () => {
    const erros: Record<string, number> = {
      "Matemática - Funções": 5,
      "Matemática - Geometria": 3,
      "Matemática - Probabilidade": 7,
      "Matemática - Trigonometria": 1,
      "Matemática - Logaritmos": 4,
      "Matemática - Estatística": 2,
      "Matemática - Análise Combinatória": 6,
      "Geografia - Clima": 2,
      "Biologia - Genética": 8,
    };
    const top = topErrosPorArea(erros);

    expect(top.MT).toHaveLength(5);
    expect(top.MT.map((t) => t.erros)).toEqual([7, 6, 5, 4, 3]);
    expect(top.MT[0]?.topico).toBe("Matemática - Probabilidade");

    expect(top.CH).toHaveLength(1);
    expect(top.CH[0]?.topico).toBe("Geografia - Clima");

    expect(top.CN).toHaveLength(1);
    expect(top.CN[0]?.erros).toBe(8);

    expect(top.LC).toHaveLength(0);
  });

  it("ignora topicos invalidos (vazio, count<=0, materia desconhecida)", () => {
    const top = topErrosPorArea({
      "  ": 5,
      "Matemática - Funções": 0,
      "Matemática - Geometria": -3,
      "Astrologia - Horóscopo": 10,
      "Biologia - Ecologia": 4,
    });
    expect(top.MT).toHaveLength(0);
    expect(top.CN).toHaveLength(1);
    expect(top.CN[0]?.topico).toBe("Biologia - Ecologia");
  });

  it("entrada vazia retorna 4 areas com array vazio", () => {
    expect(topErrosPorArea({})).toEqual({ LC: [], CH: [], CN: [], MT: [] });
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
