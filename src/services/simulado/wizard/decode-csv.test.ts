/**
 * Testes do decoder multi-encoding para CSVs.
 */

import { describe, it, expect } from "vitest";

import { decodeCsvBytes } from "./decode-csv.ts";

/** Encoda um texto como UTF-8. */
function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Encoda manualmente como Windows-1252 (bytes diretos). */
function win1252(codes: number[]): Uint8Array {
  return new Uint8Array(codes);
}

/** Encoda manualmente como Mac Roman (bytes diretos). */
function macRoman(codes: number[]): Uint8Array {
  return new Uint8Array(codes);
}

describe("decodeCsvBytes", () => {
  it("UTF-8 valido: decodifica direto", () => {
    const text = "Inglês - Compreensão de texto";
    const out = decodeCsvBytes(utf8(text));
    expect(out).toBe(text);
  });

  it("UTF-8 com BOM: TextDecoder remove BOM automaticamente", () => {
    // TextDecoder UTF-8 strip BOM por default (nao precisamos refazer)
    const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf]);
    const textBytes = utf8("numero;conteudo;gabarito");
    const combined = new Uint8Array(bomBytes.length + textBytes.length);
    combined.set(bomBytes, 0);
    combined.set(textBytes, bomBytes.length);
    const out = decodeCsvBytes(combined);
    expect(out).toBe("numero;conteudo;gabarito");
  });

  it("Windows-1252 com cedilha: decodifica corretamente", () => {
    // "Educação" em Windows-1252:
    //   E=0x45, d=0x64, u=0x75, c=0x63, a=0x61, ç=0xE7, ã=0xE3, o=0x6F
    const bytes = win1252([0x45, 0x64, 0x75, 0x63, 0x61, 0xe7, 0xe3, 0x6f]);
    const out = decodeCsvBytes(bytes);
    expect(out).toBe("Educação");
  });

  it("ISO-8859-1 (Latin-1) com acentuacao: decodifica", () => {
    // "História" em Latin-1:
    //   H=0x48, i=0x69, s=0x73, t=0x74, ó=0xF3, r=0x72, i=0x69, a=0x61
    const bytes = new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x61]);
    const out = decodeCsvBytes(bytes);
    expect(out).toBe("História");
  });

  it("Mac Roman: decodifica acentuacao PT-BR sem mojibake", () => {
    // "Educação" em Mac Roman:
    //   E=0x45, d=0x64, u=0x75, c=0x63, a=0x61, ç=0x8D, ã=0x8B, o=0x6F
    const bytes = macRoman([0x45, 0x64, 0x75, 0x63, 0x61, 0x8d, 0x8b, 0x6f]);
    const out = decodeCsvBytes(bytes);
    expect(out).toBe("Educação");
  });

  it("Mac Roman com varios acentos: escolhe melhor encoding", () => {
    // "Inglês" em Mac Roman:
    //   I=0x49, n=0x6E, g=0x67, l=0x6C, ê=0x90, s=0x73
    const bytes = new Uint8Array([0x49, 0x6e, 0x67, 0x6c, 0x90, 0x73]);
    const out = decodeCsvBytes(bytes);
    expect(out).toBe("Inglês");
  });

  it("CSV Mac Roman real do Excel BR: sem mojibake", () => {
    // Simula linha "1;Inglês - Compreensão de texto;B;3"
    // em Mac Roman: ê=0x90, ã=0x8B, ç=0x8D
    const bytes = new Uint8Array([
      0x31, 0x3b, // "1;"
      0x49, 0x6e, 0x67, 0x6c, 0x90, 0x73, // "Inglês"
      0x20, 0x2d, 0x20, // " - "
      0x43, 0x6f, 0x6d, 0x70, 0x72, 0x65, 0x65, 0x6e, 0x73, 0x8b, 0x6f, // "Compreensão"
      0x20, 0x64, 0x65, 0x20, 0x74, 0x65, 0x78, 0x74, 0x6f, // " de texto"
      0x3b, 0x42, 0x3b, 0x33, // ";B;3"
    ]);
    const out = decodeCsvBytes(bytes);
    expect(out).toContain("Inglês");
    expect(out).toContain("Compreensão de texto");
    expect(out).not.toContain("‹"); // ã nao pode virar smart quote
    expect(out).not.toContain("\uFFFD"); // sem replacement chars
  });

  it("bytes so ASCII: decodifica igual em qualquer encoding", () => {
    const bytes = utf8("hello,world");
    expect(decodeCsvBytes(bytes)).toBe("hello,world");
  });
});
