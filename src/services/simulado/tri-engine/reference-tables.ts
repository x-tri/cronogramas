/**
 * Tabelas de referencia TRI — consolidado de 9 edicoes do ENEM (2009, 2015-2022).
 *
 * Metodo: mediana dos valores Min/Med/Max entre edicoes oficiais do INEP.
 * Origem: port direto de `/Users/home/Desktop/MENTORIA XANDAO 2027/aluno/src/services/tri-reference-tables.ts`.
 *
 * Este arquivo e intencionalmente hardcoded (nao vai para DB) para garantir que
 * o motor seja self-contained e auditavel. Se uma nova calibracao chegar, basta
 * substituir os numeros aqui e bumpar a versao via comentario.
 *
 * Versao: 1.0 (consolidado 2009-2022)
 */

export type RefEntry = {
  readonly n: number
  readonly mn: number
  readonly md: number
  readonly mx: number
}

/**
 * Nota sobre tamanho das tabelas:
 * - LC tem 45 entradas (n: 0..44). O anchor oficial consolidado do INEP para
 *   Linguagens esgota em n=44 (ha somente 45 itens, mas a tabela fonte termina
 *   antes do teto maximo). O motor usa `Math.min(nCorrect, ref.length - 1)`
 *   para tratar corretamente o caso n=45.
 * - CH / CN / MT tem 46 entradas (n: 0..45), incluindo o teto maximo.
 */
export const REF_TABLES: Readonly<Record<string, readonly RefEntry[]>> = {
  LC: [
    { n: 0, mn: 303.3, md: 303.3, mx: 305.2 }, { n: 1, mn: 303.3, md: 306.7, mx: 346.9 }, { n: 2, mn: 303.3, md: 314.1, mx: 372.1 },
    { n: 3, mn: 303.3, md: 324.7, mx: 401.4 }, { n: 4, mn: 303.6, md: 336.2, mx: 422.2 }, { n: 5, mn: 304.1, md: 348.5, mx: 434.2 },
    { n: 6, mn: 304.5, md: 360.2, mx: 450.3 }, { n: 7, mn: 305.0, md: 373.1, mx: 465.0 }, { n: 8, mn: 305.6, md: 387.1, mx: 476.0 },
    { n: 9, mn: 307.8, md: 403.1, mx: 493.0 }, { n: 10, mn: 308.0, md: 419.7, mx: 503.4 }, { n: 11, mn: 309.2, md: 435.9, mx: 519.3 },
    { n: 12, mn: 315.6, md: 451.6, mx: 531.3 }, { n: 13, mn: 316.6, md: 466.5, mx: 540.6 }, { n: 14, mn: 328.7, md: 478.0, mx: 548.9 },
    { n: 15, mn: 327.3, md: 491.4, mx: 557.6 }, { n: 16, mn: 340.4, md: 503.6, mx: 560.3 }, { n: 17, mn: 355.7, md: 515.3, mx: 567.4 },
    { n: 18, mn: 363.2, md: 526.1, mx: 574.0 }, { n: 19, mn: 396.0, md: 536.4, mx: 581.4 }, { n: 20, mn: 421.6, md: 544.6, mx: 586.7 },
    { n: 21, mn: 445.9, md: 551.6, mx: 592.5 }, { n: 22, mn: 474.9, md: 558.6, mx: 596.8 }, { n: 23, mn: 486.4, md: 565.2, mx: 606.4 },
    { n: 24, mn: 504.0, md: 571.8, mx: 613.8 }, { n: 25, mn: 516.5, md: 578.3, mx: 618.5 }, { n: 26, mn: 523.3, md: 584.7, mx: 625.3 },
    { n: 27, mn: 539.9, md: 592.4, mx: 632.1 }, { n: 28, mn: 549.1, md: 603.4, mx: 647.7 }, { n: 29, mn: 557.4, md: 614.7, mx: 667.7 },
    { n: 30, mn: 564.1, md: 625.8, mx: 662.9 }, { n: 31, mn: 584.0, md: 637.1, mx: 681.0 }, { n: 32, mn: 588.1, md: 648.3, mx: 693.2 },
    { n: 33, mn: 588.3, md: 660.0, mx: 702.0 }, { n: 34, mn: 614.1, md: 671.9, mx: 713.9 }, { n: 35, mn: 625.6, md: 683.9, mx: 727.2 },
    { n: 36, mn: 641.9, md: 696.8, mx: 738.5 }, { n: 37, mn: 650.1, md: 706.8, mx: 751.4 }, { n: 38, mn: 667.2, md: 718.2, mx: 764.0 },
    { n: 39, mn: 664.7, md: 728.5, mx: 772.6 }, { n: 40, mn: 698.6, md: 741.2, mx: 787.3 }, { n: 41, mn: 710.0, md: 758.0, mx: 787.4 },
    { n: 42, mn: 731.3, md: 767.2, mx: 801.1 }, { n: 43, mn: 758.6, md: 778.8, mx: 799.4 }, { n: 44, mn: 801.7, md: 801.7, mx: 801.7 },
  ],
  CH: [
    { n: 0, mn: 328.4, md: 328.4, mx: 328.4 }, { n: 1, mn: 328.4, md: 331.9, mx: 362.6 }, { n: 2, mn: 328.4, md: 337.8, mx: 389.0 },
    { n: 3, mn: 328.5, md: 344.5, mx: 413.3 }, { n: 4, mn: 328.7, md: 353.6, mx: 431.4 }, { n: 5, mn: 329.0, md: 363.2, mx: 449.2 },
    { n: 6, mn: 329.4, md: 374.0, mx: 471.4 }, { n: 7, mn: 329.6, md: 385.6, mx: 485.4 }, { n: 8, mn: 330.4, md: 398.6, mx: 498.5 },
    { n: 9, mn: 331.0, md: 413.8, mx: 514.3 }, { n: 10, mn: 332.4, md: 431.0, mx: 520.9 }, { n: 11, mn: 332.1, md: 447.6, mx: 535.6 },
    { n: 12, mn: 333.4, md: 462.8, mx: 544.7 }, { n: 13, mn: 338.0, md: 479.4, mx: 554.4 }, { n: 14, mn: 345.6, md: 497.2, mx: 563.2 },
    { n: 15, mn: 350.6, md: 512.4, mx: 576.1 }, { n: 16, mn: 363.9, md: 526.6, mx: 587.8 }, { n: 17, mn: 380.8, md: 539.1, mx: 599.4 },
    { n: 18, mn: 394.2, md: 549.8, mx: 605.6 }, { n: 19, mn: 426.7, md: 560.9, mx: 613.3 }, { n: 20, mn: 443.9, md: 571.4, mx: 627.2 },
    { n: 21, mn: 481.2, md: 581.1, mx: 630.7 }, { n: 22, mn: 500.7, md: 592.3, mx: 641.6 }, { n: 23, mn: 517.9, md: 603.2, mx: 643.6 },
    { n: 24, mn: 541.4, md: 613.1, mx: 652.5 }, { n: 25, mn: 554.4, md: 620.0, mx: 658.2 }, { n: 26, mn: 568.8, md: 626.8, mx: 662.0 },
    { n: 27, mn: 580.5, md: 634.2, mx: 670.4 }, { n: 28, mn: 589.7, md: 642.7, mx: 677.0 }, { n: 29, mn: 596.1, md: 651.4, mx: 682.3 },
    { n: 30, mn: 609.3, md: 658.9, mx: 689.6 }, { n: 31, mn: 613.6, md: 666.3, mx: 695.2 }, { n: 32, mn: 627.7, md: 674.0, mx: 701.9 },
    { n: 33, mn: 634.4, md: 681.8, mx: 709.5 }, { n: 34, mn: 643.8, md: 690.2, mx: 718.4 }, { n: 35, mn: 652.4, md: 699.0, mx: 725.0 },
    { n: 36, mn: 660.4, md: 708.2, mx: 737.7 }, { n: 37, mn: 672.9, md: 718.3, mx: 749.7 }, { n: 38, mn: 684.6, md: 728.9, mx: 756.7 },
    { n: 39, mn: 696.1, md: 740.5, mx: 770.2 }, { n: 40, mn: 706.7, md: 750.8, mx: 783.6 }, { n: 41, mn: 725.2, md: 763.0, mx: 794.3 },
    { n: 42, mn: 739.0, md: 778.4, mx: 809.1 }, { n: 43, mn: 759.8, md: 796.2, mx: 825.6 }, { n: 44, mn: 789.5, md: 822.2, mx: 840.9 },
    { n: 45, mn: 850.6, md: 850.6, mx: 850.6 },
  ],
  CN: [
    { n: 0, mn: 339.7, md: 339.7, mx: 339.7 }, { n: 1, mn: 339.7, md: 343.2, mx: 380.3 }, { n: 2, mn: 339.7, md: 352.6, mx: 415.9 },
    { n: 3, mn: 339.8, md: 360.3, mx: 436.3 }, { n: 4, mn: 339.9, md: 370.5, mx: 454.0 }, { n: 5, mn: 340.2, md: 381.7, mx: 469.8 },
    { n: 6, mn: 340.4, md: 393.4, mx: 485.4 }, { n: 7, mn: 340.8, md: 405.7, mx: 507.9 }, { n: 8, mn: 341.6, md: 419.4, mx: 520.4 },
    { n: 9, mn: 342.5, md: 433.9, mx: 544.2 }, { n: 10, mn: 342.8, md: 448.9, mx: 551.7 }, { n: 11, mn: 343.6, md: 464.7, mx: 565.1 },
    { n: 12, mn: 347.6, md: 482.3, mx: 577.6 }, { n: 13, mn: 349.6, md: 499.7, mx: 581.8 }, { n: 14, mn: 351.1, md: 516.8, mx: 597.4 },
    { n: 15, mn: 359.6, md: 533.2, mx: 608.1 }, { n: 16, mn: 372.1, md: 548.8, mx: 618.8 }, { n: 17, mn: 390.5, md: 563.5, mx: 628.8 },
    { n: 18, mn: 405.2, md: 577.3, mx: 635.9 }, { n: 19, mn: 427.4, md: 590.1, mx: 646.4 }, { n: 20, mn: 450.9, md: 602.1, mx: 653.4 },
    { n: 21, mn: 474.6, md: 613.4, mx: 662.0 }, { n: 22, mn: 520.7, md: 623.7, mx: 665.3 }, { n: 23, mn: 547.5, md: 633.2, mx: 676.7 },
    { n: 24, mn: 572.0, md: 643.4, mx: 678.1 }, { n: 25, mn: 595.0, md: 651.0, mx: 686.6 }, { n: 26, mn: 602.1, md: 658.5, mx: 695.3 },
    { n: 27, mn: 614.7, md: 666.3, mx: 702.2 }, { n: 28, mn: 613.6, md: 674.3, mx: 709.5 }, { n: 29, mn: 639.0, md: 681.5, mx: 719.7 },
    { n: 30, mn: 644.8, md: 689.4, mx: 727.1 }, { n: 31, mn: 658.0, md: 696.7, mx: 736.4 }, { n: 32, mn: 666.5, md: 704.7, mx: 743.2 },
    { n: 33, mn: 676.6, md: 712.8, mx: 750.0 }, { n: 34, mn: 686.3, md: 721.2, mx: 767.4 }, { n: 35, mn: 692.3, md: 729.2, mx: 769.3 },
    { n: 36, mn: 706.5, md: 738.6, mx: 780.6 }, { n: 37, mn: 712.4, md: 749.1, mx: 791.9 }, { n: 38, mn: 723.7, md: 759.7, mx: 796.2 },
    { n: 39, mn: 733.5, md: 771.2, mx: 806.3 }, { n: 40, mn: 742.8, md: 782.7, mx: 816.2 }, { n: 41, mn: 758.7, md: 796.2, mx: 834.3 },
    { n: 42, mn: 777.8, md: 812.5, mx: 848.7 }, { n: 43, mn: 800.7, md: 833.3, mx: 858.8 }, { n: 44, mn: 834.4, md: 856.8, mx: 868.5 },
    { n: 45, mn: 875.2, md: 875.2, mx: 875.2 },
  ],
  MT: [
    { n: 0, mn: 345.9, md: 345.9, mx: 345.9 }, { n: 1, mn: 345.9, md: 348.2, mx: 384.4 }, { n: 2, mn: 345.9, md: 352.4, mx: 414.9 },
    { n: 3, mn: 345.9, md: 364.2, mx: 444.4 }, { n: 4, mn: 345.9, md: 374.4, mx: 481.5 }, { n: 5, mn: 345.9, md: 389.5, mx: 515.7 },
    { n: 6, mn: 345.9, md: 403.1, mx: 543.9 }, { n: 7, mn: 346.0, md: 417.9, mx: 570.0 }, { n: 8, mn: 346.0, md: 434.7, mx: 585.3 },
    { n: 9, mn: 346.6, md: 451.4, mx: 602.7 }, { n: 10, mn: 347.1, md: 475.0, mx: 619.9 }, { n: 11, mn: 346.6, md: 500.5, mx: 634.5 },
    { n: 12, mn: 348.0, md: 526.7, mx: 667.4 }, { n: 13, mn: 352.3, md: 553.3, mx: 671.7 }, { n: 14, mn: 358.5, md: 579.4, mx: 685.4 },
    { n: 15, mn: 361.6, md: 600.5, mx: 693.6 }, { n: 16, mn: 373.5, md: 618.5, mx: 703.1 }, { n: 17, mn: 388.0, md: 642.8, mx: 712.7 },
    { n: 18, mn: 402.8, md: 667.2, mx: 723.1 }, { n: 19, mn: 407.5, md: 683.1, mx: 730.2 }, { n: 20, mn: 434.2, md: 695.0, mx: 739.2 },
    { n: 21, mn: 472.8, md: 706.0, mx: 750.2 }, { n: 22, mn: 557.8, md: 716.9, mx: 758.5 }, { n: 23, mn: 574.8, md: 727.1, mx: 765.0 },
    { n: 24, mn: 632.5, md: 737.2, mx: 783.1 }, { n: 25, mn: 645.4, md: 747.4, mx: 793.9 }, { n: 26, mn: 679.5, md: 757.2, mx: 800.4 },
    { n: 27, mn: 687.1, md: 766.9, mx: 816.3 }, { n: 28, mn: 701.5, md: 778.4, mx: 825.3 }, { n: 29, mn: 719.1, md: 791.3, mx: 838.7 },
    { n: 30, mn: 731.1, md: 803.8, mx: 845.8 }, { n: 31, mn: 739.7, md: 817.0, mx: 862.8 }, { n: 32, mn: 752.4, md: 830.2, mx: 870.4 },
    { n: 33, mn: 770.5, md: 844.1, mx: 880.5 }, { n: 34, mn: 782.7, md: 855.5, mx: 893.4 }, { n: 35, mn: 805.6, md: 864.1, mx: 906.7 },
    { n: 36, mn: 813.6, md: 875.0, mx: 910.5 }, { n: 37, mn: 827.4, md: 885.2, mx: 931.3 }, { n: 38, mn: 846.4, md: 895.7, mx: 940.3 },
    { n: 39, mn: 852.0, md: 906.6, mx: 959.5 }, { n: 40, mn: 875.7, md: 921.8, mx: 963.6 }, { n: 41, mn: 889.8, md: 941.6, mx: 975.2 },
    { n: 42, mn: 919.9, md: 962.0, mx: 983.9 }, { n: 43, mn: 945.8, md: 975.7, mx: 985.3 }, { n: 44, mn: 975.0, md: 985.0, mx: 985.7 },
    { n: 45, mn: 992.7, md: 992.7, mx: 992.7 },
  ],
}

export type AreaKey = 'LC' | 'CH' | 'CN' | 'MT'

export type AreaConfig = {
  readonly key: AreaKey
  readonly label: string
  readonly color: string
  /** Intervalo de questoes (1-indexed, inclusivo nos dois lados). */
  readonly range: readonly [number, number]
}

export const AREAS: readonly AreaConfig[] = [
  { key: 'LC', label: 'Linguagens',  color: '#3B82F6', range: [1, 45] },
  { key: 'CH', label: 'Humanas',     color: '#F97316', range: [46, 90] },
  { key: 'CN', label: 'Natureza',    color: '#10B981', range: [91, 135] },
  { key: 'MT', label: 'Matematica',  color: '#EF4444', range: [136, 180] },
] as const

export type ProficiencyLevel = {
  readonly label: string
  readonly min: number
  readonly max: number
  readonly color: string
  readonly bg: string
  readonly desc: string
}

export const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = [
  { label: 'Abaixo do Basico', min: 0,   max: 449,  color: '#C0392B', bg: '#FDEDEC', desc: 'Nao demonstra dominio minimo das competencias esperadas ao final do EM.' },
  { label: 'Basico',           min: 450, max: 549,  color: '#E67E22', bg: '#FEF5E7', desc: 'Nivel associado a certificacao de conclusao do EM. Dominio elementar.' },
  { label: 'Adequado',         min: 550, max: 649,  color: '#2E86C1', bg: '#EBF5FB', desc: 'Dominio satisfatorio. Consegue aplicar conhecimentos em situacoes diversas.' },
  { label: 'Avancado',         min: 650, max: 1000, color: '#1B4F72', bg: '#D4E6F1', desc: 'Dominio pleno. Analise, reflexao e integracao em alto nivel de complexidade.' },
] as const

export function getProficiency(score: number | null | undefined): ProficiencyLevel | null {
  if (score == null) return null
  return (
    PROFICIENCY_LEVELS.find((p) => score >= p.min && score <= p.max) ??
    PROFICIENCY_LEVELS[0]
  )
}
