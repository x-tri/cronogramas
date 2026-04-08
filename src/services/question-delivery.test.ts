import { describe, expect, it } from 'vitest'
import {
  buildQuestionCandidateMap,
  hasUsableOptions,
  pickBestQuestionCandidate,
  questionRequiresVisualContext,
  resolveQuestionImageUrl,
  shouldRenderQuestionImage,
  sortQuestionOptions,
  type QuestionCandidateRow,
  type QuestionOptionRow,
} from './question-delivery'

function buildOptions(values: ReadonlyArray<[string, string, boolean]>): QuestionOptionRow[] {
  return values.map(([letter, text, isCorrect]) => ({ letter, text, is_correct: isCorrect }))
}

describe('question-delivery', () => {
  it('ordena alternativas em A-E', () => {
    const sorted = sortQuestionOptions(
      buildOptions([
        ['E', 'opção e', false],
        ['C', 'opção c', false],
        ['A', 'opção a', true],
        ['D', 'opção d', false],
        ['B', 'opção b', false],
      ]),
    )

    expect(sorted.map((option) => option.letter)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('rejeita conjunto de alternativas-placeholder', () => {
    expect(
      hasUsableOptions(
        buildOptions([
          ['A', 'A', false],
          ['B', 'B', false],
          ['C', 'C', false],
          ['D', 'D', false],
          ['E', 'E', true],
        ]),
      ),
    ).toBe(false)
  })

  it('detecta quando a questão depende de figura', () => {
    expect(
      questionRequiresVisualContext({
        stem: 'Qual região foi selecionada para o investimento da construtora?',
        support_text: 'A seguir, está apresentada a matriz com os dados da pesquisa.',
        image_alt: null,
      }),
    ).toBe(true)
  })

  it('prefere a variante ENEM regular em vez da PPL quando ambas existem', () => {
    const enem: QuestionCandidateRow = {
      id: 'enem',
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
      id: 'ppl',
      source_year: 2021,
      source_question: 156,
      source_exam: 'PPL 2021',
      stem: 'Qual região foi selecionada para o investimento da construtora?',
      support_text: 'A seguir, está apresentada a matriz com os dados da pesquisa.',
      image_url:
        'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/PPL_2021/questions/156/image_0.png',
      image_alt: null,
    }

    const optionsById = new Map<string, ReadonlyArray<QuestionOptionRow>>([
      [
        'enem',
        buildOptions([
          ['A', '1', false],
          ['B', '2', false],
          ['C', '3', false],
          ['D', '4', false],
          ['E', '5', true],
        ]),
      ],
      [
        'ppl',
        buildOptions([
          ['A', 'A', false],
          ['B', 'B', false],
          ['C', 'C', false],
          ['D', 'D', false],
          ['E', 'E', true],
        ]),
      ],
    ])

    expect(pickBestQuestionCandidate([ppl, enem], optionsById)?.id).toBe('enem')
  })

  it('descarta item visual sem imagem confiável', () => {
    const candidate: QuestionCandidateRow = {
      id: 'visual-sem-imagem',
      source_year: 2019,
      source_question: 53,
      source_exam: 'ENEM 2019',
      stem: 'Produzida no Chile, a imagem expressa um conflito entre culturas.',
      support_text: 'Observe a imagem.',
      image_url: 'https://enem.devenem-data/enem-2019/53-images/context_img_0.png',
      image_alt: null,
    }

    const optionsById = new Map<string, ReadonlyArray<QuestionOptionRow>>([
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
    ])

    expect(pickBestQuestionCandidate([candidate], optionsById)).toBeNull()
  })

  it('agrupa candidatas por ano e questão', () => {
    const grouped = buildQuestionCandidateMap([
      {
        id: '1',
        source_year: 2022,
        source_question: 141,
        source_exam: 'ENEM 2022',
        stem: '',
        support_text: '',
        image_url: null,
      },
      {
        id: '2',
        source_year: 2022,
        source_question: 141,
        source_exam: 'PPL 2022',
        stem: '',
        support_text: '',
        image_url: null,
      },
    ])

    expect(grouped.get('2022:141')?.map((candidate) => candidate.id)).toEqual(['1', '2'])
  })

  it('só renderiza imagem quando ela é parte da resolução', () => {
    expect(
      shouldRenderQuestionImage({
        imagemUrl:
          'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/2021/156/correta.png',
        requiresVisualContext: true,
      }),
    ).toBe(true)

    expect(
      shouldRenderQuestionImage({
        imagemUrl:
          'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/2020/119/alguma.png',
        requiresVisualContext: false,
      }),
    ).toBe(false)
  })

  it('recompõe a imagem pela candidata mais nova com a mesma assinatura textual', () => {
    const chosen: QuestionCandidateRow = {
      id: 'enem',
      source_year: 2021,
      source_question: 156,
      source_exam: 'ENEM 2021',
      created_at: '2026-03-23T00:32:51.422481+00:00',
      stem: 'Qual região foi selecionada para o investimento da construtora?',
      support_text: 'A seguir, está apresentada a matriz com os dados da pesquisa.',
      image_url:
        'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/2021/156/formula.png',
      image_alt: null,
    }

    const siblingWithBetterImage: QuestionCandidateRow = {
      ...chosen,
      id: 'ppl',
      source_exam: 'PPL 2021',
      created_at: '2026-04-02T02:16:01.749475+00:00',
      image_url:
        'https://uhqdkaftqjxenobdfqkd.supabase.co/storage/v1/object/public/enem-images/PPL_2021/questions/156/image_0.png',
    }

    expect(resolveQuestionImageUrl([chosen, siblingWithBetterImage], chosen)).toBe(
      siblingWithBetterImage.image_url,
    )
  })
})
