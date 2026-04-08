import { describe, expect, it } from 'vitest'
import {
  KNOWN_QUESTION_BANK_FAILURE_CASES,
  collectAuditFindingsForCandidates,
} from './question-bank-audit'
import type { QuestionCandidateRow, QuestionOptionRow } from './question-delivery'

function buildOptions(values: ReadonlyArray<[string, string, boolean]>): QuestionOptionRow[] {
  return values.map(([letter, text, isCorrect]) => ({
    letter,
    text,
    is_correct: isCorrect,
  }))
}

describe('question-bank-audit', () => {
  it('mantém a suite mandatória de casos conhecidos', () => {
    expect(KNOWN_QUESTION_BANK_FAILURE_CASES).toEqual([
      { sourceYear: 2019, sourceQuestion: 53 },
      { sourceYear: 2020, sourceQuestion: 119 },
      { sourceYear: 2023, sourceQuestion: 102 },
      { sourceYear: 2021, sourceQuestion: 156 },
      { sourceYear: 2022, sourceQuestion: 141 },
      { sourceYear: 2022, sourceQuestion: 175 },
    ])
  })

  it('marca conflito ENEM vs PPL quando há variantes do mesmo item', async () => {
    const enem: QuestionCandidateRow = {
      id: 'enem-2021-156',
      source_year: 2021,
      source_question: 156,
      source_exam: 'ENEM 2021',
      stem: 'Qual região foi selecionada para o investimento da construtora?',
      support_text: 'A seguir, está apresentada a matriz com os dados da pesquisa.',
      image_url:
        'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/2021/156/correta.png',
      image_alt: null,
    }

    const ppl: QuestionCandidateRow = {
      id: 'ppl-2021-156',
      source_year: 2021,
      source_question: 156,
      source_exam: 'PPL 2021',
      stem: 'Qual região foi selecionada para o investimento da construtora?',
      support_text: 'A seguir, está apresentada a matriz com os dados da pesquisa.',
      image_url:
        'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/PPL_2021/questions/156/image_0.png',
      image_alt: null,
    }

    const optionsByQuestionId = new Map<string, ReadonlyArray<QuestionOptionRow>>([
      [
        enem.id,
        buildOptions([
          ['A', '1', false],
          ['B', '2', false],
          ['C', '3', false],
          ['D', '4', false],
          ['E', '5', true],
        ]),
      ],
      [
        ppl.id,
        buildOptions([
          ['A', 'A', false],
          ['B', 'B', false],
          ['C', 'C', false],
          ['D', 'D', false],
          ['E', 'E', true],
        ]),
      ],
    ])

    const findings = await collectAuditFindingsForCandidates({
      sourceYear: 2021,
      sourceQuestion: 156,
      candidates: [enem, ppl],
      optionsByQuestionId,
    })

    expect(findings.some((finding) => finding.defectType === 'duplicate_conflict')).toBe(true)
    expect(findings.some((finding) => finding.defectType === 'enem_vs_ppl_conflict')).toBe(true)
  })

  it('detecta host quebrado e ausência de contexto visual', async () => {
    const candidate: QuestionCandidateRow = {
      id: 'enem-2019-53',
      source_year: 2019,
      source_question: 53,
      source_exam: 'ENEM 2019',
      stem: 'Produzida no Chile, a imagem expressa um conflito entre culturas.',
      support_text: 'Observe a imagem.',
      image_url: 'https://enem.devenem-data/enem-2019/53-images/context_img_0.png',
      image_alt: null,
    }

    const findings = await collectAuditFindingsForCandidates({
      sourceYear: 2019,
      sourceQuestion: 53,
      candidates: [candidate],
      optionsByQuestionId: new Map([
        [
          candidate.id,
          buildOptions([
            ['A', 'opção a', false],
            ['B', 'opção b', true],
            ['C', 'opção c', false],
            ['D', 'opção d', false],
            ['E', 'opção e', false],
          ]),
        ],
      ]),
    })

    expect(findings.some((finding) => finding.defectType === 'broken_image_host')).toBe(true)
    expect(findings.some((finding) => finding.defectType === 'missing_visual_context')).toBe(true)
  })
})
