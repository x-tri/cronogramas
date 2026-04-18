/**
 * exportRankingExcel — gera e dispara download de .xlsx com 5 abas:
 *   1. Ranking      — tabela completa com TRI, acertos, posição, diff
 *   2. Estatísticas — stats do grupo (média, desvio, melhor, pior)
 *   3. Tópicos      — top tópicos errados pela turma
 *   4. Áreas        — média de acertos por área
 *   5. Não responderam — alunos sem resposta
 *
 * Função pura: recebe dados já calculados, sem efeitos colaterais além
 * do download do browser. Testável via check das estruturas de dados.
 */

import * as XLSX from "xlsx";

import type { GrupoStats, RankedStudent } from "./ranking-aggregations";

export interface NaoRespondeuRow {
  readonly id: string;
  readonly name: string | null;
  readonly turma: string | null;
  readonly matricula: string | null;
}

export interface ExportRankingPayload {
  readonly simuladoTitle: string;
  readonly turmaLabel: string; // "Todas" | "3A" | etc
  readonly ranked: ReadonlyArray<RankedStudent>;
  readonly stats: GrupoStats;
  readonly topTopicos: ReadonlyArray<{
    topico: string;
    totalErros: number;
    alunosAfetados: number;
  }>;
  readonly mediaArea: {
    readonly LC: number;
    readonly CH: number;
    readonly CN: number;
    readonly MT: number;
  };
  readonly naoResponderam: ReadonlyArray<NaoRespondeuRow>;
}

const AREA_NOMES: Record<string, string> = {
  LC: "Linguagens e Códigos",
  CH: "Ciências Humanas",
  CN: "Ciências da Natureza",
  MT: "Matemática",
};

function round1(n: number | null): number | string {
  if (n == null) return "";
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Aba 1 — Ranking completo
// ---------------------------------------------------------------------------
function buildRankingSheet(
  ranked: ReadonlyArray<RankedStudent>,
): XLSX.WorkSheet {
  const header = [
    "Pos.",
    "Aluno",
    "Turma",
    "TRI LC",
    "TRI CH",
    "TRI CN",
    "TRI MT",
    "Média TRI",
    "± Turma",
    "Acertos LC",
    "Acertos CH",
    "Acertos CN",
    "Acertos MT",
    "Total Acertos",
    "Máx. possível",
    "Enviado em",
  ];

  const rows = ranked.map((r) => [
    r.posicao,
    r.resposta.student_name ?? "(sem nome)",
    r.resposta.student_turma ?? "",
    round1(r.resposta.tri_lc),
    round1(r.resposta.tri_ch),
    round1(r.resposta.tri_cn),
    round1(r.resposta.tri_mt),
    round1(r.mediaTri),
    r.diffTurma == null ? "" : Math.round(r.diffTurma),
    r.resposta.acertos_lc,
    r.resposta.acertos_ch,
    r.resposta.acertos_cn,
    r.resposta.acertos_mt,
    r.totalAcertos,
    180,
    r.resposta.submitted_at
      ? new Date(r.resposta.submitted_at).toLocaleString("pt-BR")
      : "",
  ]);

  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

// ---------------------------------------------------------------------------
// Aba 2 — Estatísticas do grupo
// ---------------------------------------------------------------------------
function buildStatsSheet(
  stats: GrupoStats,
  simuladoTitle: string,
  turmaLabel: string,
): XLSX.WorkSheet {
  const rows = [
    ["Simulado", simuladoTitle],
    ["Turma/Filtro", turmaLabel],
    [],
    ["Métrica", "Valor"],
    ["Alunos responderam", stats.count],
    ["Média TRI", round1(stats.media)],
    ["Desvio Padrão", stats.desvio != null ? +stats.desvio.toFixed(1) : ""],
    ["Maior TRI", round1(stats.melhor)],
    ["Menor TRI", round1(stats.pior)],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

// ---------------------------------------------------------------------------
// Aba 3 — Tópicos mais errados
// ---------------------------------------------------------------------------
function buildTopicosSheet(
  topTopicos: ReadonlyArray<{
    topico: string;
    totalErros: number;
    alunosAfetados: number;
  }>,
): XLSX.WorkSheet {
  const header = ["#", "Tópico", "Total de Erros", "Alunos Afetados"];
  const rows = topTopicos.map((t, i) => [
    i + 1,
    t.topico,
    t.totalErros,
    t.alunosAfetados,
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

// ---------------------------------------------------------------------------
// Aba 4 — Acertos por área
// ---------------------------------------------------------------------------
function buildAreasSheet(mediaArea: {
  LC: number;
  CH: number;
  CN: number;
  MT: number;
}): XLSX.WorkSheet {
  const header = ["Área", "Disciplina", "Média de Acertos", "Máx. (45)"];
  const rows = (["LC", "CH", "CN", "MT"] as const).map((k) => [
    k,
    AREA_NOMES[k],
    +mediaArea[k].toFixed(1),
    45,
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

// ---------------------------------------------------------------------------
// Aba 5 — Não responderam
// ---------------------------------------------------------------------------
function buildNaoResponderamSheet(
  naoResponderam: ReadonlyArray<NaoRespondeuRow>,
): XLSX.WorkSheet {
  const header = ["Aluno", "Turma", "Matrícula"];
  const rows = naoResponderam.map((s) => [
    s.name ?? "(sem nome)",
    s.turma ?? "",
    s.matricula ?? "",
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------
export function exportRankingExcel(payload: ExportRankingPayload): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildRankingSheet(payload.ranked),
    "Ranking",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildStatsSheet(payload.stats, payload.simuladoTitle, payload.turmaLabel),
    "Estatísticas",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTopicosSheet(payload.topTopicos),
    "Tópicos Errados",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildAreasSheet(payload.mediaArea),
    "Acertos por Área",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildNaoResponderamSheet(payload.naoResponderam),
    "Não Responderam",
  );

  // Sanitiza nome de arquivo: remove chars inválidos
  const safeTitle = payload.simuladoTitle
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim()
    .slice(0, 60);
  const filename = `ranking-${safeTitle || "simulado"}.xlsx`;

  XLSX.writeFile(wb, filename);
}
