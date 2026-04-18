/**
 * Testes do parser CSV do wizard (Fase 3.2).
 */

import { describe, it, expect } from 'vitest'

import { parseSimuladoCsv, countByArea } from './csv-parser.ts'

// Helpers ---------------------------------------------------------------

function makeHeader(): string {
  return 'numero,conteudo,gabarito,dificuldade'
}

/** Gera CSV valido completo (180 linhas). */
function makeFullCsv(): string {
  const lines = [makeHeader()]
  for (let n = 1; n <= 180; n++) {
    lines.push(`${n},Topico ${n},A,${(n % 5) + 1}`)
  }
  return lines.join('\n')
}

// ----------------------------------------------------------------------
// Header validation
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — cabecalho', () => {
  it('rejeita quando cabecalho falta colunas', () => {
    const csv = 'numero,gabarito\n1,A'
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]!.message).toMatch(/conteudo/)
    expect(r.errors[0]!.message).toMatch(/dificuldade/)
  })

  it('aceita cabecalho case-insensitive e com espacos', () => {
    const csv = ' Numero , Conteudo , Gabarito , DIFICULDADE \n1,Funcoes,A,3'
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(1)
    expect(r.items[0]!.topico).toBe('Funcoes')
  })

  it('rejeita CSV completamente vazio', () => {
    const r = parseSimuladoCsv('')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]!.message).toMatch(/vazio/i)
  })

  it('ignora linhas em branco entre itens', () => {
    const csv = [makeHeader(), '1,A,A,3', '', '  ', '2,B,B,4'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(2)
  })
})

// ----------------------------------------------------------------------
// Validacao de valores
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — validacao de valores', () => {
  it('rejeita numero fora de 1..180', () => {
    const csv = [makeHeader(), '0,X,A,3', '181,X,A,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(2)
    expect(r.errors[0]!.message).toMatch(/faixa/)
  })

  it('rejeita gabarito diferente de A-E', () => {
    const csv = [makeHeader(), '1,X,F,3', '2,Y,Z,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(2)
    for (const e of r.errors) {
      expect(e.message).toMatch(/gabarito/i)
    }
  })

  it('aceita gabarito minusculo (normaliza)', () => {
    const csv = [makeHeader(), '1,X,a,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.gabarito).toBe('A')
  })

  it('rejeita dificuldade fora de 1..5', () => {
    const csv = [makeHeader(), '1,X,A,0', '2,Y,A,6', '3,Z,A,abc'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(3)
  })

  it('conteudo vazio -> topico=null', () => {
    const csv = [makeHeader(), '1,,A,3', '2,"  ",B,4'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.topico).toBeNull()
    expect(r.items[1]!.topico).toBeNull()
  })
})

// ----------------------------------------------------------------------
// CSV quoting (RFC 4180 subset)
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — CSV quoting', () => {
  it('aceita valores com virgula interna envoltos em aspas', () => {
    const csv = [makeHeader(), '1,"Funcao, logaritmo",A,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.topico).toBe('Funcao, logaritmo')
  })

  it('aceita aspas duplas escapadas dentro de quoted', () => {
    const csv = [makeHeader(), '1,"Obra ""Vidas Secas""",A,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.topico).toBe('Obra "Vidas Secas"')
  })
})

// ----------------------------------------------------------------------
// Duplicatas
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — duplicatas', () => {
  it('rejeita numero duplicado com mensagem apontando para a primeira ocorrencia', () => {
    const csv = [makeHeader(), '5,X,A,3', '10,Y,B,4', '5,Z,C,5'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]!.message).toMatch(/duplicado/i)
    expect(r.errors[0]!.message).toMatch(/linha 2/)
  })
})

// ----------------------------------------------------------------------
// Full exam
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — exame completo', () => {
  it('aceita 180 itens validos e ordena por numero', () => {
    const r = parseSimuladoCsv(makeFullCsv())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(180)
    expect(r.items[0]!.numero).toBe(1)
    expect(r.items[179]!.numero).toBe(180)
  })

  it('requireFullExam: rejeita quando count != 180', () => {
    const csv = [makeHeader(), '1,X,A,3'].join('\n')
    const r = parseSimuladoCsv(csv, { requireFullExam: true })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]!.message).toMatch(/180/)
  })

  it('requireFullExam: aceita quando count == 180', () => {
    const r = parseSimuladoCsv(makeFullCsv(), { requireFullExam: true })
    expect(r.ok).toBe(true)
  })
})

// ----------------------------------------------------------------------
// Utilitario de countByArea
// ----------------------------------------------------------------------

describe('countByArea', () => {
  it('conta corretamente por area', () => {
    const r = parseSimuladoCsv(makeFullCsv())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const counts = countByArea(r.items)
    expect(counts).toEqual({ LC: 45, CH: 45, CN: 45, MT: 45 })
  })

  it('retorna zeros em array vazio', () => {
    expect(countByArea([])).toEqual({ LC: 0, CH: 0, CN: 0, MT: 0 })
  })
})

// ----------------------------------------------------------------------
// Delimitador auto-detect (Excel BR usa ;)
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — auto-detect delimitador', () => {
  it('detecta ; como delimitador quando ha mais ; que ,', () => {
    const csv = [
      'numero;conteudo;gabarito;dificuldade',
      '1;"Funcao, logaritmo";A;3',
      '2;Geometria;B;4',
    ].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(2)
    expect(r.items[0]!.topico).toBe('Funcao, logaritmo')
    expect(r.items[0]!.gabarito).toBe('A')
    expect(r.items[1]!.topico).toBe('Geometria')
  })

  it('continua aceitando , quando predominante', () => {
    const csv = [
      'numero,conteudo,gabarito,dificuldade',
      '1,Funcao exponencial,A,3',
    ].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.topico).toBe('Funcao exponencial')
  })

  it('Excel BR com acentuacao + ; roda sem problema', () => {
    const csv = [
      'numero;conteudo;gabarito;dificuldade',
      '1;Inglês - Compreensão de texto;B;3',
      '2;História - Revolução Francesa;D;4',
      '3;Matemática - Funções exponenciais;A;5',
    ].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]!.topico).toBe('Inglês - Compreensão de texto')
    expect(r.items[1]!.topico).toBe('História - Revolução Francesa')
    expect(r.items[2]!.topico).toBe('Matemática - Funções exponenciais')
  })
})

// ----------------------------------------------------------------------
// Line tracking
// ----------------------------------------------------------------------

describe('parseSimuladoCsv — tracking de linhas', () => {
  it('reporta linha correta (1-indexed) nos erros', () => {
    const csv = [makeHeader(), '1,X,A,3', '', '3,Y,F,3'].join('\n')
    const r = parseSimuladoCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    // linha 1=header, 2=item ok, 3=blank (ignored), 4=item invalido
    expect(r.errors[0]!.line).toBe(4)
  })
})
