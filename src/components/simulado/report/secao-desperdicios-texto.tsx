import type { ParametrosTRI, MapaHabilidades, ItemTRI, SisuAnalysis } from '../../../types/report'
import type { SimuladoResult } from '../../../types/supabase'
import { getConteudoDidatico } from '../../../constants/habilidade-conteudo'
import { AREA_NOMES, formatDificuldadeSimples } from './constants'

interface SecaoDesperdiciosTextoProps {
  readonly parametrosTRI: ParametrosTRI
  readonly mapaHabilidades: MapaHabilidades
  readonly simulado?: SimuladoResult
  readonly sisu?: SisuAnalysis
}

/** Encontra a habilidade associada a uma questao errada */
function findHabForQ(
  questionNumber: number,
  mapaHabilidades: MapaHabilidades,
): string | null {
  for (const erro of mapaHabilidades.errosPorHabilidade) {
    if (erro.questoesErradas.includes(questionNumber)) return erro.identificador
  }
  return null
}

/** Calcula impacto estimado em pontos */
function estimarImpacto(item: ItemTRI): number {
  const facilidade = Math.max(0, 1 - item.paramDificuldade)
  return Math.round(facilidade * item.paramDiscriminacao * 8)
}

/** Calcula estatísticas de impacto reais a partir dos itens */
function computeImpactStats(items: ReadonlyArray<ItemTRI>): {
  media: number
  min: number
  max: number
  total: number
} {
  if (items.length === 0) return { media: 0, min: 0, max: 0, total: 0 }
  const impactos = items.map(estimarImpacto)
  const total = impactos.reduce((s, v) => s + v, 0)
  return {
    media: Math.round(total / impactos.length),
    min: Math.min(...impactos),
    max: Math.max(...impactos),
    total,
  }
}

/** Converte questionNumber (1-180) para área */
function getAreaFromQn(qn: number): string {
  if (qn <= 45) return 'LC'
  if (qn <= 90) return 'CH'
  if (qn <= 135) return 'CN'
  return 'MT'
}

export function SecaoDesperdiciosTexto({
  parametrosTRI,
  mapaHabilidades,
  simulado,
  sisu,
}: SecaoDesperdiciosTextoProps) {
  const { desperdicios, errosEsperados } = parametrosTRI

  const allDesp = [...desperdicios].sort((a, b) => a.paramDificuldade - b.paramDificuldade)
  const temDadosTRI = allDesp.length > 0

  // Calcular impactos reais
  const despStats = computeImpactStats(allDesp)
  const errosEspStats = computeImpactStats(errosEsperados)

  // Dados para análise por área (sempre disponíveis)
  const errosPorArea: Record<string, number> = {}
  for (const erro of mapaHabilidades.errosPorHabilidade) {
    errosPorArea[erro.area] = (errosPorArea[erro.area] ?? 0) + erro.totalErros
  }

  // Se não temos dados granulares de TRI (simulado escolar), contar erros das wrongQuestions por área
  if (Object.keys(errosPorArea).length === 0 && simulado) {
    for (const wq of simulado.wrongQuestions) {
      const area = getAreaFromQn(wq.questionNumber)
      errosPorArea[area] = (errosPorArea[area] ?? 0) + 1
    }
  }

  const totalErros = mapaHabilidades.totalQuestoesErradas || simulado?.wrongQuestions.length || 0

  // TRI por área
  const triLC = simulado?.studentAnswer?.tri_lc ?? undefined
  const triCH = simulado?.studentAnswer?.tri_ch ?? undefined
  const triCN = simulado?.studentAnswer?.tri_cn ?? undefined
  const triMT = simulado?.studentAnswer?.tri_mt ?? undefined
  const triMap: Record<string, number | undefined> = { LC: triLC, CH: triCH, CN: triCN, MT: triMT }

  // Conteúdos mais errados por área
  const topConteudos = mapaHabilidades.errosPorHabilidade
    .slice(0, 8)
    .map(e => ({ area: e.area, conteudo: getConteudoDidatico(e.identificador), erros: e.totalErros }))

  return (
    <div>
      <h3 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-1">
        Análise de Erros e Impacto TRI
      </h3>
      <p className="text-[11px] text-[#6b7280] mb-3">
        No modelo TRI, o impacto de cada erro depende da dificuldade da questão e da consistência do padrão de respostas.
        Errar questões fáceis penaliza muito mais do que errar questões difíceis.
      </p>

      {/* Análise por área — SEMPRE aparece */}
      <div className="mb-4">
        <p className="text-[11px] text-[#374151] mb-3 leading-relaxed">
          Você errou <span className="font-bold text-[#ef4444]">{totalErros} questões</span> no simulado,
          distribuídas da seguinte forma:
        </p>

        <div className="space-y-2 mb-4">
          {(['LC', 'CH', 'CN', 'MT'] as const).map(area => {
            const erros = errosPorArea[area] ?? 0
            const acertos = 45 - erros
            const tri = triMap[area]
            const areaNome = AREA_NOMES[area] ?? area
            const pesoSisu = sisu?.roiPorArea.find(r => r.sigla === area)
            const aproveitamento = Math.round((acertos / 45) * 100)

            // Top conteúdos errados desta área
            const conteudosArea = topConteudos.filter(c => c.area === area)

            return (
              <div key={area} className="text-[11px] text-[#374151] leading-relaxed">
                <span className="font-bold text-[#1d1d1f]">
                  {areaNome}:
                </span>{' '}
                {erros} erros de 45 ({aproveitamento}% de aproveitamento)
                {tri != null ? <> · TRI: <span className="font-semibold">{tri.toFixed(0)}</span></> : null}
                {pesoSisu ? <> · Peso SISU: {pesoSisu.peso}</> : null}.
                {erros > 15 ? (
                  <span className="text-[#ef4444]"> Desempenho crítico — precisa de atenção urgente.</span>
                ) : erros > 8 ? (
                  <span className="text-[#d97706]"> Desempenho abaixo do esperado.</span>
                ) : erros > 3 ? (
                  <span className="text-[#6b7280]"> Desempenho razoável, mas com margem de melhoria.</span>
                ) : (
                  <span className="text-[#10b981]"> Bom desempenho.</span>
                )}
                {conteudosArea.length > 0 ? (
                  <> Conteúdos com mais erros: <span className="font-semibold">{conteudosArea.map(c => `${c.conteudo} (${c.erros})`).join(', ')}</span>.</>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Desperdícios TRI detalhados — quando temos dados granulares (prova ENEM oficial) */}
      {temDadosTRI ? (
        <div>
          <p className="text-[11px] font-bold text-[#1d1d1f] mb-2">Desperdícios TRI identificados:</p>
          <p className="text-[11px] text-[#374151] mb-4 leading-relaxed">
            Você errou{' '}
            <span className="font-bold text-[#ef4444]">{allDesp.length} questões fáceis</span>{' '}
            e {errosEsperados.length} questões difíceis.
            Cada questão fácil errada custou em média ~{despStats.media} pontos
            (variando de {despStats.min} a {despStats.max}),
            totalizando ~{despStats.total} pontos perdidos em desperdícios
            {errosEsperados.length > 0
              ? `, enquanto cada questão difícil errada custou em média ~${errosEspStats.media} pontos`
              : ''}.
          </p>

          <div className="space-y-1 mb-4">
            {allDesp.slice(0, 15).map((item, i) => {
              const habInfo = findHabForQ(item.questionNumber, mapaHabilidades)
              const conteudo = habInfo
                ? getConteudoDidatico(habInfo)
                : AREA_NOMES[item.area] ?? item.area
              const impacto = estimarImpacto(item)
              const areaNome = AREA_NOMES[item.area] ?? item.area
              const dif = formatDificuldadeSimples(item.paramDificuldade)

              return (
                <p key={item.questionNumber} className="text-[11px] text-[#374151] leading-relaxed">
                  <span className="font-bold text-[#1d1d1f]">
                    {i + 1}. Q{item.questionNumber} ({areaNome})
                  </span>{' '}
                  — {conteudo}. Dificuldade {dif} (b={item.paramDificuldade.toFixed(2)}).{' '}
                  <span className="font-bold text-[#ef4444]">~{impacto} pts perdidos.</span>
                </p>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-bold text-[#1d1d1f] mb-2">Impacto TRI estimado:</p>
          <p className="text-[11px] text-[#374151] mb-3 leading-relaxed">
            Este simulado não usa questões ENEM oficiais, então não temos os parâmetros TRI individuais de cada questão.
            Porém, com base na sua nota TRI por área e quantidade de erros, podemos estimar o impacto:
          </p>
          <div className="space-y-1 mb-4">
            {(['LC', 'CH', 'CN', 'MT'] as const).map(area => {
              const erros = errosPorArea[area] ?? 0
              if (erros === 0) return null
              const tri = triMap[area]
              const areaNome = AREA_NOMES[area] ?? area
              // Estimativa: TRI baixa + muitos erros = muitos desperdícios
              const triRef = tri ?? 500
              const estimativaDesperdicios = erros > 10
                ? Math.round(erros * 0.6)  // ~60% dos erros são desperdícios quando erra muito
                : Math.round(erros * 0.4)
              const impactoEstimado = Math.round(estimativaDesperdicios * (triRef < 500 ? 12 : triRef < 600 ? 10 : 8))

              return (
                <p key={area} className="text-[11px] text-[#374151] leading-relaxed">
                  <span className="font-bold text-[#1d1d1f]">{areaNome}:</span>{' '}
                  Com {erros} erros e TRI {tri?.toFixed(0) ?? 'N/A'}, estima-se que ~{estimativaDesperdicios} foram
                  questões que você deveria ter acertado,
                  representando ~{impactoEstimado} pontos que poderiam ter sido recuperados.
                </p>
              )
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Recomendação — SEMPRE aparece */}
      <div className="border-t border-[#e3e2e0] pt-3">
        <p className="text-[11px] text-[#374151] leading-relaxed">
          <span className="font-bold text-[#1d1d1f]">Recomendação: </span>
          {temDadosTRI ? (
            <>
              Antes de estudar conteúdos novos, revise os conteúdos das questões fáceis que você errou.
              No TRI, acertar as fáceis é mais rentável do que acertar as difíceis.
              Revise prioritariamente:{' '}
              <span className="font-semibold text-[#1d1d1f]">
                {[...new Set(
                  allDesp.slice(0, 5).map((item) => {
                    const habInfo = findHabForQ(item.questionNumber, mapaHabilidades)
                    return habInfo ? getConteudoDidatico(habInfo) : AREA_NOMES[item.area] ?? item.area
                  }),
                )].join(', ')}
              </span>.
            </>
          ) : (
            <>
              Foque nas áreas com mais erros e menor TRI. Revise os conteúdos básicos dessas áreas
              antes de avançar para conteúdos difíceis.
              {topConteudos.length > 0 ? (
                <> Priorize: <span className="font-semibold text-[#1d1d1f]">
                  {topConteudos.slice(0, 5).map(c => c.conteudo).join(', ')}
                </span>.</>
              ) : null}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
