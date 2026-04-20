/**
 * Decoder inteligente para CSVs com encoding indefinido.
 *
 * Problema real observado em producao:
 *   - Excel BR salva CSV em Windows-1252 (Latin1 + smart quotes)
 *   - LibreOffice Calc BR salva em ISO-8859-1
 *   - Excel Mac (antigo) salva em Mac Roman (macintosh)
 *   - Excel moderno salva em UTF-8 (as vezes com BOM)
 *
 * Estrategia:
 *   1. Tenta UTF-8 com fatal=true. Se valido, usa (cobre Excel moderno).
 *   2. Se falhar, decodifica nos 3 encodings legados e pontua cada um
 *      pela quantidade de caracteres validos em portugues — sem mojibake.
 *   3. Retorna o texto com maior pontuacao.
 *
 * A pontuacao premia caracteres comuns em PT-BR (ã é í ó ú ê ô ç à ...) e
 * penaliza heavy caracteres tipicos de mojibake (‹ › ‡ † caracteres de
 * controle 0x80-0x9F, replacement U+FFFD).
 */

const PORTUGUESE_CHARS = new Set(
  "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇºª".split(""),
);

// Caracteres raros em PT que aparecem em mojibake vindo de Mac Roman/1252.
const MOJIBAKE_HINTS = new Set(
  "‹›‡†•‰ƒ„…‘’“”–—˜™šœžŸ¢¤¥¦¨©«®±²³µ¶·¸¼½¾".split(""),
);

/** Pontua um texto: +10 por char PT-BR, -5 por hint de mojibake, -20 por U+FFFD. */
function scoreText(text: string): number {
  let score = 0;
  for (const ch of text) {
    if (PORTUGUESE_CHARS.has(ch)) score += 10;
    else if (MOJIBAKE_HINTS.has(ch)) score -= 5;
    else if (ch === "\uFFFD") score -= 20; // replacement char = decode ruim
    else if (ch.charCodeAt(0) < 0x20 && ch !== "\n" && ch !== "\r" && ch !== "\t") {
      score -= 15; // control char tambem indica encoding errado
    }
  }
  return score;
}

/**
 * Tenta decodificar bytes como CSV, escolhendo o encoding que produz
 * o texto mais plausivel em portugues.
 *
 * Exportado para facilitar testes — em producao usado pelo step-items.tsx.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  // 1. UTF-8 estrito (se valido, usa direto)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Continua para fallback
  }

  // 2. Decodifica nos 3 encodings legados e pontua
  const candidates: ReadonlyArray<string> = [
    "windows-1252",
    "iso-8859-1",
    "macintosh",
  ];

  let bestText = "";
  let bestScore = -Infinity;

  for (const enc of candidates) {
    let text: string;
    try {
      text = new TextDecoder(enc).decode(bytes);
    } catch {
      continue;
    }
    const score = scoreText(text);
    if (score > bestScore) {
      bestScore = score;
      bestText = text;
    }
  }

  // Se tudo falhar (improvavel), usa Windows-1252 como ultimo recurso.
  if (!bestText) {
    bestText = new TextDecoder("windows-1252").decode(bytes);
  }
  return bestText;
}
