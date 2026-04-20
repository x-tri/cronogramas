/**
 * Pure aggregations para o ranking de simulado do coordenador.
 *
 * Separado do componente React para:
 *   - Testar sem DOM
 *   - Reusar em export CSV / relatorios PDF
 *   - Evitar recompute em render
 */

export type AreaKey = "LC" | "CH" | "CN" | "MT";

export interface RankingResposta {
  readonly id: string;
  readonly student_id: string;
  readonly student_name: string | null;
  readonly student_turma: string | null;
  readonly tri_lc: number | null;
  readonly tri_ch: number | null;
  readonly tri_cn: number | null;
  readonly tri_mt: number | null;
  readonly acertos_lc: number;
  readonly acertos_ch: number;
  readonly acertos_cn: number;
  readonly acertos_mt: number;
  readonly erros_por_topico: Record<string, number>;
  readonly submitted_at: string;
}

export interface RankedStudent {
  readonly posicao: number;
  readonly resposta: RankingResposta;
  readonly mediaTri: number | null;
  readonly totalAcertos: number;
  /** Diferença da média da turma (positivo = acima). Null se turma=1. */
  readonly diffTurma: number | null;
}

/** Computa média simples das 4 áreas (sem redação). Null se alguma área null. */
export function mediaTriSimples(r: RankingResposta): number | null {
  const { tri_lc, tri_ch, tri_cn, tri_mt } = r;
  if (tri_lc == null || tri_ch == null || tri_cn == null || tri_mt == null) {
    return null;
  }
  return (tri_lc + tri_ch + tri_cn + tri_mt) / 4;
}

/** Soma dos acertos nas 4 áreas. */
export function totalAcertos(r: RankingResposta): number {
  return r.acertos_lc + r.acertos_ch + r.acertos_cn + r.acertos_mt;
}

/**
 * Ordena respostas por média desc (null por último), atribui posição e
 * diff em relação à média agregada de TODAS as respostas.
 */
export function rankRespostas(
  respostas: ReadonlyArray<RankingResposta>,
): ReadonlyArray<RankedStudent> {
  const withMedia = respostas.map((r) => ({
    resposta: r,
    mediaTri: mediaTriSimples(r),
  }));

  const mediasValidas = withMedia
    .map((x) => x.mediaTri)
    .filter((x): x is number => x != null);
  const mediaGrupo =
    mediasValidas.length === 0
      ? null
      : mediasValidas.reduce((a, b) => a + b, 0) / mediasValidas.length;

  const sorted = [...withMedia].sort((a, b) => {
    if (a.mediaTri == null && b.mediaTri == null) return 0;
    if (a.mediaTri == null) return 1;
    if (b.mediaTri == null) return -1;
    return b.mediaTri - a.mediaTri;
  });

  return sorted.map((entry, idx) => ({
    posicao: idx + 1,
    resposta: entry.resposta,
    mediaTri: entry.mediaTri,
    totalAcertos: totalAcertos(entry.resposta),
    diffTurma:
      mediaGrupo == null || entry.mediaTri == null
        ? null
        : entry.mediaTri - mediaGrupo,
  }));
}

/**
 * Estatísticas do grupo: média, desvio padrão, melhor, pior, N.
 */
export interface GrupoStats {
  readonly count: number;
  readonly media: number | null;
  readonly desvio: number | null;
  readonly melhor: number | null;
  readonly pior: number | null;
}

export function statsGrupo(
  respostas: ReadonlyArray<RankingResposta>,
): GrupoStats {
  const medias = respostas
    .map(mediaTriSimples)
    .filter((x): x is number => x != null);

  if (medias.length === 0) {
    return { count: 0, media: null, desvio: null, melhor: null, pior: null };
  }

  const media = medias.reduce((a, b) => a + b, 0) / medias.length;
  const variancia =
    medias.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / medias.length;
  const desvio = Math.sqrt(variancia);
  const melhor = Math.max(...medias);
  const pior = Math.min(...medias);

  return {
    count: medias.length,
    media,
    desvio,
    melhor,
    pior,
  };
}

/**
 * Agrega `erros_por_topico` de todas as respostas e retorna os N tópicos
 * mais errados pela turma TODA, ordenados desc.
 */
export function topicosErradosTurma(
  respostas: ReadonlyArray<RankingResposta>,
  limit = 5,
): ReadonlyArray<{ topico: string; totalErros: number; alunosAfetados: number }> {
  const totais = new Map<string, { total: number; alunos: Set<string> }>();

  for (const r of respostas) {
    const topicos = r.erros_por_topico ?? {};
    for (const [topico, n] of Object.entries(topicos)) {
      const t = topico.trim();
      if (!t || typeof n !== "number" || n <= 0) continue;
      const prev = totais.get(t) ?? { total: 0, alunos: new Set() };
      prev.total += n;
      prev.alunos.add(r.student_id);
      totais.set(t, prev);
    }
  }

  return [...totais.entries()]
    .map(([topico, v]) => ({
      topico,
      totalErros: v.total,
      alunosAfetados: v.alunos.size,
    }))
    .sort((a, b) => b.totalErros - a.totalErros)
    .slice(0, limit);
}

/**
 * Mapeamento matéria → área do ENEM.
 *
 * O formato dos tópicos é "Matéria - Tema" ou "Matéria/Subárea - Tema".
 * Ex: "Geografia - Fusos horários", "Matemática/Probabilidade - Eventos".
 * Aqui classificamos a MATÉRIA raiz (antes de `/` ou ` - `) nas 4 áreas ENEM.
 */
const MATERIA_TO_AREA: Record<string, AreaKey> = {
  // LC — Linguagens, Códigos e suas Tecnologias
  Literatura: "LC",
  Arte: "LC",
  "Língua Portuguesa": "LC",
  Inglês: "LC",
  Espanhol: "LC",
  "Produção de Texto": "LC",
  Redação: "LC",
  "Educação Física": "LC",

  // CH — Ciências Humanas e suas Tecnologias
  Geografia: "CH",
  "Geografia urbana": "CH",
  "Geografia física": "CH",
  História: "CH",
  "História do Brasil": "CH",
  "História do Brasil Colonial": "CH",
  "História Antiga": "CH",
  Sociologia: "CH",
  Filosofia: "CH",
  Geopolítica: "CH",

  // CN — Ciências da Natureza e suas Tecnologias
  Biologia: "CN",
  Química: "CN",
  "Química Orgânica": "CN",
  Física: "CN",

  // MT — Matemática e suas Tecnologias
  Matemática: "MT",
  "Geometria plana": "MT",
  "Geometria espacial": "MT",
  "Análise combinatória": "MT",
  Trigonometria: "MT",
};

/**
 * Extrai a matéria raiz de um tópico do ENEM.
 *
 *   "Geografia - Fusos horários"           → "Geografia"
 *   "Matemática/Probabilidade - Eventos"   → "Matemática"
 *   "Sociologia/Política - Estado direito" → "Sociologia"
 *
 * Quando o tópico tem barra composta (ex: "Geografia/Sociologia"), retorna
 * só o primeiro termo — que é a matéria principal para fins de classificação.
 */
export function extrairMateriaRaiz(topico: string): string {
  const limpo = topico.trim();
  // Encontra o primeiro separador — barra ou hífen com espaços
  const idxBarra = limpo.indexOf("/");
  const idxHifen = limpo.indexOf(" - ");
  const candidatos = [idxBarra, idxHifen].filter((i) => i >= 0);
  if (candidatos.length === 0) return limpo;
  const fim = Math.min(...candidatos);
  return limpo.slice(0, fim).trim();
}

/**
 * Classifica um tópico em uma das 4 áreas do ENEM. Retorna `null` se a
 * matéria raiz não bater com nenhuma conhecida (ex: tópico mal-formatado).
 */
export function areaDoTopico(topico: string): AreaKey | null {
  const materia = extrairMateriaRaiz(topico);
  return MATERIA_TO_AREA[materia] ?? null;
}

/**
 * Retorna o tópico MAIS errado em cada uma das 4 áreas do ENEM.
 *
 * Útil quando o N de respondentes é baixo e o "top 5 geral" fica cheio de
 * empates sem significado pedagógico. Com 1 tópico por área, o coordenador
 * de cada disciplina identifica imediatamente onde focar o próximo reforço.
 *
 * Tópicos não-classificáveis (matéria fora do mapa) são ignorados.
 * Áreas sem nenhum erro retornam `null`.
 */
export function topicoMaisErradoPorArea(
  respostas: ReadonlyArray<RankingResposta>,
): Record<AreaKey, { topico: string; totalErros: number; alunosAfetados: number } | null> {
  // Agrega por tópico + já classifica
  interface Acc {
    readonly area: AreaKey;
    total: number;
    alunos: Set<string>;
  }
  const porTopico = new Map<string, Acc>();

  for (const r of respostas) {
    const topicos = r.erros_por_topico ?? {};
    for (const [topico, n] of Object.entries(topicos)) {
      const t = topico.trim();
      if (!t || typeof n !== "number" || n <= 0) continue;
      const area = areaDoTopico(t);
      if (area == null) continue;
      const prev = porTopico.get(t) ?? { area, total: 0, alunos: new Set() };
      prev.total += n;
      prev.alunos.add(r.student_id);
      porTopico.set(t, prev);
    }
  }

  // Agrupa por área e pega o maior de cada
  const resultado: Record<
    AreaKey,
    { topico: string; totalErros: number; alunosAfetados: number } | null
  > = { LC: null, CH: null, CN: null, MT: null };

  for (const [topico, acc] of porTopico.entries()) {
    const atual = resultado[acc.area];
    if (atual == null || acc.total > atual.totalErros) {
      resultado[acc.area] = {
        topico,
        totalErros: acc.total,
        alunosAfetados: acc.alunos.size,
      };
    }
  }

  return resultado;
}

/**
 * Média de acertos por área da turma (0-45). Usado no mini bar chart
 * "Áreas mais fracas da turma".
 */
export function mediaAcertosPorArea(
  respostas: ReadonlyArray<RankingResposta>,
): Record<AreaKey, number> {
  if (respostas.length === 0) {
    return { LC: 0, CH: 0, CN: 0, MT: 0 };
  }
  const somas = { LC: 0, CH: 0, CN: 0, MT: 0 };
  for (const r of respostas) {
    somas.LC += r.acertos_lc;
    somas.CH += r.acertos_ch;
    somas.CN += r.acertos_cn;
    somas.MT += r.acertos_mt;
  }
  const n = respostas.length;
  return {
    LC: somas.LC / n,
    CH: somas.CH / n,
    CN: somas.CN / n,
    MT: somas.MT / n,
  };
}

/**
 * Histograma de notas em bins fixos de 50pts (200-1000 => 16 bins).
 * Retorna [ {min, max, count} ] útil pra render de barras.
 */
export interface HistogramBin {
  readonly min: number;
  readonly max: number;
  readonly count: number;
}

export function histogramaNotas(
  respostas: ReadonlyArray<RankingResposta>,
  binSize = 50,
): ReadonlyArray<HistogramBin> {
  const bins: HistogramBin[] = [];
  for (let min = 200; min < 1000; min += binSize) {
    bins.push({ min, max: min + binSize, count: 0 });
  }
  for (const r of respostas) {
    const media = mediaTriSimples(r);
    if (media == null) continue;
    const idx = Math.min(bins.length - 1, Math.floor((media - 200) / binSize));
    if (idx >= 0 && idx < bins.length) {
      bins[idx] = { ...bins[idx]!, count: bins[idx]!.count + 1 };
    }
  }
  return bins;
}

/**
 * Extrai turmas distintas não-nulas das respostas, sorted asc.
 */
export function turmasPresentes(
  respostas: ReadonlyArray<RankingResposta>,
): ReadonlyArray<string> {
  const set = new Set<string>();
  for (const r of respostas) {
    if (r.student_turma) set.add(r.student_turma);
  }
  return [...set].sort();
}

/**
 * Filtra respostas por turma. Se turma='' retorna todas.
 */
export function filtrarPorTurma(
  respostas: ReadonlyArray<RankingResposta>,
  turma: string,
): ReadonlyArray<RankingResposta> {
  if (!turma) return respostas;
  return respostas.filter((r) => r.student_turma === turma);
}
