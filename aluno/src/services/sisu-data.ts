/**
 * Lista hardcoded de cursos por universidade com notas de corte de
 * referencia (SISU ampla concorrencia, valores aproximados 2024).
 *
 * Usado pelo SisuThermometer para renderizar cursos alcancaveis e proximos
 * niveis a partir da nota do aluno. Futuramente pode vir do enemDataSupabase.
 */

export interface SisuCurso {
  readonly curso: string;
  readonly notaCorte: number;
  readonly emoji: string;
}

export interface SisuUniversidade {
  readonly sigla: string;
  readonly nome: string;
  readonly uf: string;
  readonly cursos: ReadonlyArray<SisuCurso>;
}

// UFRN — cortes aproximados AC 2024, ordem decrescente.
const UFRN_CURSOS: ReadonlyArray<SisuCurso> = [
  { curso: "Medicina", notaCorte: 780, emoji: "🩺" },
  { curso: "Odontologia", notaCorte: 710, emoji: "🦷" },
  { curso: "Direito", notaCorte: 680, emoji: "⚖️" },
  { curso: "Psicologia", notaCorte: 665, emoji: "🧠" },
  { curso: "Engenharia Civil", notaCorte: 640, emoji: "🏗️" },
  { curso: "Enfermagem", notaCorte: 620, emoji: "💊" },
  { curso: "Fisioterapia", notaCorte: 610, emoji: "🤸" },
  { curso: "Arquitetura", notaCorte: 600, emoji: "📐" },
  { curso: "Ciência da Computação", notaCorte: 590, emoji: "💻" },
  { curso: "Engenharia de Produção", notaCorte: 580, emoji: "⚙️" },
  { curso: "Biomedicina", notaCorte: 570, emoji: "🔬" },
  { curso: "Nutrição", notaCorte: 560, emoji: "🥗" },
  { curso: "Administração", notaCorte: 540, emoji: "📈" },
  { curso: "Ciências Contábeis", notaCorte: 500, emoji: "📊" },
  { curso: "Jornalismo", notaCorte: 490, emoji: "📰" },
  { curso: "Serviço Social", notaCorte: 470, emoji: "🤝" },
  { curso: "Pedagogia", notaCorte: 430, emoji: "📚" },
  { curso: "Letras", notaCorte: 410, emoji: "✍️" },
  { curso: "Educação Física", notaCorte: 400, emoji: "⚽" },
];

const UNIVERSIDADES: ReadonlyArray<SisuUniversidade> = [
  { sigla: "UFRN", nome: "Universidade Federal do Rio Grande do Norte", uf: "RN", cursos: UFRN_CURSOS },
];

/**
 * Retorna a universidade (com lista de cursos) pelo par sigla+uf,
 * case-insensitive. Null se nao esta na lista hardcoded.
 */
export function getUniversidade(
  sigla: string | null | undefined,
  uf: string | null | undefined,
): SisuUniversidade | null {
  if (!sigla || !uf) return null;
  const normalized = sigla.trim().toUpperCase();
  const ufNorm = uf.trim().toUpperCase();
  return (
    UNIVERSIDADES.find(
      (u) => u.sigla === normalized && u.uf === ufNorm,
    ) ?? null
  );
}

/**
 * Dados exibidos no termometro. Filtra cursos ate 200 pts acima da meta
 * (contexto do topo) e ordena decrescente.
 */
export interface ThermometerData {
  readonly universidade: SisuUniversidade;
  readonly cursosRanked: ReadonlyArray<SisuCurso>;
  readonly alcancaveis: ReadonlyArray<SisuCurso>;
  readonly proxima: SisuCurso | null;
}

export function buildThermometerData(
  universidade: SisuUniversidade,
  mediaEnem: number,
): ThermometerData {
  const cursosRanked = [...universidade.cursos].sort(
    (a, b) => b.notaCorte - a.notaCorte,
  );
  const alcancaveis = cursosRanked.filter((c) => c.notaCorte <= mediaEnem);
  const proxima =
    cursosRanked
      .filter((c) => c.notaCorte > mediaEnem)
      .sort((a, b) => a.notaCorte - b.notaCorte)[0] ?? null;

  return { universidade, cursosRanked, alcancaveis, proxima };
}

/**
 * Média ENEM oficial: media simples das 4 areas mais a redacao.
 *
 * Por enquanto usamos REDACAO = 900 hardcoded como proxy (decisao do
 * produto: aluno ainda nao submete redacao no app, mas a media precisa
 * refletir o ENEM completo pra comparar com cortes SISU).
 */
export const REDACAO_HARDCODED = 900;

/**
 * Retorna a media ENEM SOMENTE quando as 4 areas estao preenchidas.
 * Com TRI parcial (ex: edge function timeout em uma area), retornar uma
 * "media" menor com denominador reduzido enganaria o aluno mostrando-o
 * em faixa mais alta do que a real — e faria o termometro SISU sugerir
 * cursos que ele nao alcanca de fato.
 */
export function mediaEnemComRedacao(
  tri: {
    readonly lc: number | null;
    readonly ch: number | null;
    readonly cn: number | null;
    readonly mt: number | null;
  },
  redacao: number = REDACAO_HARDCODED,
): number | null {
  const { lc, ch, cn, mt } = tri;
  if (lc == null || ch == null || cn == null || mt == null) return null;
  return (lc + ch + cn + mt + redacao) / 5;
}
