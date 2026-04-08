import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type {
  ReportData,
  HabilidadeCritica,
  ItemTRI,
  AreaSigla,
  ErroHabilidade,
} from '../../types/report'
import type { SimuladoResult } from '../../types/supabase'
import { getConteudoDidatico } from '../../constants/habilidade-conteudo'

// ── Cores por area ──

const AREA_COLORS: Record<string, string> = {
  CN: '#10b981', CH: '#f97316', LC: '#3b82f6', MT: '#ef4444', RED: '#8b5cf6',
}

const AREA_NOMES: Record<string, string> = {
  CN: 'Ciências da Natureza', CH: 'Ciências Humanas',
  LC: 'Linguagens e Códigos', MT: 'Matemática', RED: 'Redação',
}

// ── Helpers ──

function fmtNota(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(0)}%`
}

function prioLabel(score: number): { text: string; color: string } {
  if (score >= 10) return { text: 'CRÍTICO', color: '#991b1b' }
  if (score >= 5) return { text: 'ALTA', color: '#dc2626' }
  if (score >= 2) return { text: 'MÉDIA', color: '#d97706' }
  return { text: 'BAIXA', color: '#6b7280' }
}

function dificuldadeSimples(d: number): string {
  if (d < -0.5) return 'fácil'
  if (d < 1.0) return 'médio'
  return 'difícil'
}

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

function countErrosByArea(erros: ReadonlyArray<ErroHabilidade>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of erros) { counts[e.area] = (counts[e.area] ?? 0) + e.totalErros }
  return counts
}

function groupHabsByArea(
  habs: ReadonlyArray<HabilidadeCritica>,
): ReadonlyArray<{ area: AreaSigla; totalErros: number; items: ReadonlyArray<HabilidadeCritica> }> {
  const map = new Map<AreaSigla, HabilidadeCritica[]>()
  for (const h of habs) {
    const existing = map.get(h.area)
    if (existing) { existing.push(h) } else { map.set(h.area, [h]) }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].reduce((s, h) => s + h.totalErros, 0) - a[1].reduce((s, h) => s + h.totalErros, 0))
    .map(([area, items]) => ({ area, totalErros: items.reduce((s, h) => s + h.totalErros, 0), items }))
}

function findHabForQ(questionNumber: number, report: ReportData): string | null {
  for (const erro of report.mapaHabilidades.errosPorHabilidade) {
    if (erro.questoesErradas.includes(questionNumber)) return erro.identificador
  }
  return null
}

// ── Styles ──

const M = 34
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8.2,
    paddingTop: 26,
    paddingBottom: 34,
    paddingHorizontal: M,
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerBlock: { flex: 1, paddingRight: 12 },
  kicker: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  h1: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
  headerAluno: { fontSize: 10, color: '#111827', marginTop: 2, fontFamily: 'Helvetica-Bold' },
  headerCurso: { fontSize: 7.6, color: '#4b5563', marginTop: 2, lineHeight: 1.4 },
  headerData: { fontSize: 7, color: '#6b7280', marginTop: 3 },
  headerLogo: { width: 34, height: 34 },
  mdH2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 8.6,
    fontFamily: 'Helvetica-Bold',
    marginTop: 5,
    marginBottom: 2,
  },
  mdText: {
    fontSize: 7.6,
    color: '#374151',
    lineHeight: 1.58,
    marginBottom: 3,
  },
  mdMuted: {
    fontSize: 7.3,
    color: '#6b7280',
    lineHeight: 1.5,
    marginBottom: 3,
  },
  mdBullet: {
    fontSize: 7.5,
    color: '#374151',
    lineHeight: 1.52,
    marginBottom: 1.5,
    paddingLeft: 8,
    textIndent: -8,
  },
  mdOrdered: {
    fontSize: 7.4,
    color: '#374151',
    lineHeight: 1.52,
    marginBottom: 1.8,
  },
  divider: { height: 0.6, backgroundColor: '#e5e7eb', marginVertical: 5 },
  areaSection: {
    marginTop: 3,
    marginBottom: 2,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#d1d5db',
  },
  textBold: { fontFamily: 'Helvetica-Bold' },
  textRed: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  badgeLine: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: M,
    right: M,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },
  footerLogo: { width: 14, height: 14 },
  footerText: { fontSize: 6, color: '#9ca3af', flex: 1 },
})

interface Props {
  readonly report: ReportData
  readonly nomeAluno: string
  readonly simulado?: SimuladoResult
}

export function RelatorioCirurgicoPDF({ report, nomeAluno, simulado }: Props) {
  const { sisuAnalysis } = report
  const hoje = new Date(report.computedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const gapValue = sisuAnalysis.gap ?? 0

  const sortedRoi = [...sisuAnalysis.roiPorArea].sort((a, b) => b.valorPontoFinal - a.valorPontoFinal)
  const sortedHabs = [...report.questoesRecomendadas.habilidadesCriticas].sort((a, b) => b.score - a.score)
  const groupedHabs = groupHabsByArea(sortedHabs)
  const allDesp = [...report.parametrosTRI.desperdicios].sort((a, b) => a.paramDificuldade - b.paramDificuldade)
  const errosByArea = countErrosByArea(report.mapaHabilidades.errosPorHabilidade)

  // Calcular impactos reais em vez de hardcodar
  const despStats = computeImpactStats(allDesp)
  const errosEspStats = computeImpactStats(report.parametrosTRI.errosEsperados)

  const triLC = simulado?.studentAnswer?.tri_lc ?? null
  const triCH = simulado?.studentAnswer?.tri_ch ?? null
  const triCN = simulado?.studentAnswer?.tri_cn ?? null
  const triMT = simulado?.studentAnswer?.tri_mt ?? null
  const triMap: Record<string, number | null> = { LC: triLC, CH: triCH, CN: triCN, MT: triMT }

  const totalQPerArea = 45
  const totalErrosObjetivas = (['LC', 'CH', 'CN', 'MT'] as const).reduce((sum, area) => sum + (errosByArea[area] ?? 0), 0)
  const totalAcertosObjetivas = 180 - totalErrosObjetivas
  const topConteudos = report.mapaHabilidades.errosPorHabilidade
    .slice(0, 8)
    .map(e => ({ area: e.area, conteudo: getConteudoDidatico(e.identificador), erros: e.totalErros }))
  const topRoi = sortedRoi[0]
  const botRoi = sortedRoi[sortedRoi.length - 1]
  const cursoNome = sisuAnalysis.curso
    ? `${sisuAnalysis.curso.nome} — ${sisuAnalysis.curso.universidade}${sisuAnalysis.curso.campus ? ` (${sisuAnalysis.curso.campus})` : ''}${sisuAnalysis.curso.estado ? ` — ${sisuAnalysis.curso.estado}` : ''}`
    : null
  const resumoGap = gapValue < 0
    ? `faltam ${fmtNota(Math.abs(gapValue))} pontos para alcançar a nota de corte`
    : `você está ${fmtNota(gapValue)} pontos acima da nota de corte`
  const origemRentavel = topRoi
    ? `${AREA_NOMES[topRoi.sigla] ?? topRoi.area} é hoje a área mais rentável no SISU deste curso: cada +1 ponto TRI vale ${topRoi.valorPontoFinal.toFixed(2)} na nota final.`
    : null
  const conteudosPrioritarios = topConteudos.slice(0, 5).map((item) => item.conteudo)

  return (
    <Document title={`Relatório de Desempenho ENEM — ${nomeAluno}`}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <View style={s.headerBlock}>
            <Text style={s.kicker}>Relatório escrito · visão pedagógica</Text>
            <Text style={s.h1}>Relatório de desempenho ENEM</Text>
            <Text style={s.headerAluno}>{nomeAluno}</Text>
            {cursoNome ? <Text style={s.headerCurso}>{cursoNome}</Text> : null}
            <Text style={s.headerData}>Gerado em {hoje}.</Text>
          </View>
          <Image src="/logo-xtri.png" style={s.headerLogo} />
        </View>

        <Text style={s.mdH2}>## Resumo executivo</Text>
        <Text style={s.mdText}>
          Sua nota ponderada atual é <Text style={s.textBold}>{fmtNota(sisuAnalysis.notaPonderadaAtual)}</Text>. A nota de corte de referência é <Text style={s.textBold}>{fmtNota(sisuAnalysis.notaCorte)}</Text>; hoje, <Text style={gapValue < 0 ? s.textRed : s.textBold}>{resumoGap}</Text>.
          {' '}Nas provas objetivas, foram mapeados <Text style={s.textBold}>{totalAcertosObjetivas} acertos</Text> e <Text style={s.textBold}>{totalErrosObjetivas} erros</Text>.
        </Text>
        {origemRentavel ? (
          <Text style={s.mdText}>{origemRentavel}</Text>
        ) : null}
        <Text style={s.mdBullet}>- Nota ponderada: {fmtNota(sisuAnalysis.notaPonderadaAtual)}</Text>
        <Text style={s.mdBullet}>- Nota de corte ({sisuAnalysis.anoReferencia ?? 'referência mais recente'}): {fmtNota(sisuAnalysis.notaCorte)}</Text>
        <Text style={s.mdBullet}>- Gap atual: {gapValue >= 0 ? '+' : ''}{fmtNota(gapValue)}</Text>
        {sisuAnalysis.vagas != null ? (
          <Text style={s.mdBullet}>- Vagas informadas para o curso: {sisuAnalysis.vagas}</Text>
        ) : null}
        {conteudosPrioritarios.length > 0 ? (
          <Text style={s.mdBullet}>- Conteúdos que mais puxam a revisão agora: {conteudosPrioritarios.join(', ')}.</Text>
        ) : null}

        <Text style={s.mdH2}>## Desempenho por área</Text>
        {(['LC', 'CH', 'CN', 'MT'] as const).map((sigla) => {
          const erros = errosByArea[sigla] ?? 0
          const peso = sisuAnalysis.pesos
            ? sigla === 'LC' ? sisuAnalysis.pesos.linguagens
              : sigla === 'CH' ? sisuAnalysis.pesos.cienciasHumanas
                : sigla === 'CN' ? sisuAnalysis.pesos.cienciasNatureza
                  : sisuAnalysis.pesos.matematica
            : null
          return (
            <Text key={sigla} style={s.mdBullet}>
              - <Text style={[s.textBold, { color: AREA_COLORS[sigla] }]}>{AREA_NOMES[sigla]}</Text>: TRI {fmtNota(triMap[sigla])}, {totalQPerArea - erros}/{totalQPerArea} acertos, {erros} erros e peso {peso != null ? peso.toFixed(1) : '—'}.
            </Text>
          )
        })}
        {sisuAnalysis.pesos ? (
          <Text style={s.mdBullet}>- <Text style={[s.textBold, { color: AREA_COLORS.RED }]}>Redação</Text>: peso {sisuAnalysis.pesos.redacao.toFixed(1)}.</Text>
        ) : null}
        {topRoi && botRoi ? (
          <Text style={s.mdMuted}>
            Cada +1 ponto TRI em {AREA_NOMES[topRoi.sigla] ?? topRoi.area} (peso {topRoi.peso}) vale {topRoi.valorPontoFinal.toFixed(2)} na nota final. Subir 10 pontos em {AREA_NOMES[topRoi.sigla] ?? topRoi.area} equivale a subir {Math.round((topRoi.valorPontoFinal / (botRoi.valorPontoFinal || 1)) * 10)} pontos em {AREA_NOMES[botRoi.sigla] ?? botRoi.area}.
          </Text>
        ) : null}

        <View style={s.divider} />

        {report.perfilAprovados ? (
          <View>
            <Text style={s.mdH2}>## Perfil dos aprovados ({report.perfilAprovados.ano})</Text>
            <Text style={s.mdText}>
              Foram analisados {report.perfilAprovados.totalAprovados} aprovados em {report.perfilAprovados.modalidade}. Esse recorte funciona como referência de competitividade real para o curso selecionado.
            </Text>
            <Text style={s.mdBullet}>- Nota mínima: {fmtNota(report.perfilAprovados.notaMinima)}</Text>
            <Text style={s.mdBullet}>- Percentil 25: {fmtNota(report.perfilAprovados.notaP25)}</Text>
            <Text style={s.mdBullet}>- Média: {fmtNota(report.perfilAprovados.notaMedia)}</Text>
            <Text style={s.mdBullet}>- Percentil 75: {fmtNota(report.perfilAprovados.notaP75)}</Text>
            <Text style={s.mdBullet}>- Nota máxima: {fmtNota(report.perfilAprovados.notaMaxima)}</Text>

            <Text style={s.mdText}>
              <Text style={s.textBold}>Leitura do seu posicionamento: </Text>
              {sisuAnalysis.notaPonderadaAtual != null ? (
                <>
                  Sua nota ponderada atual ({fmtNota(sisuAnalysis.notaPonderadaAtual)}) está{' '}
                  {sisuAnalysis.notaPonderadaAtual < report.perfilAprovados.notaMinima
                    ? `abaixo da nota mínima dos aprovados (${fmtNota(report.perfilAprovados.notaMinima)}). Você precisa subir ${fmtNota(report.perfilAprovados.notaMinima - sisuAnalysis.notaPonderadaAtual)} pontos para alcançar o patamar mínimo de aprovação.`
                    : sisuAnalysis.notaPonderadaAtual < report.perfilAprovados.notaMedia
                      ? `entre a mínima e a média dos aprovados. Você precisa subir ${fmtNota(report.perfilAprovados.notaMedia - sisuAnalysis.notaPonderadaAtual)} pontos para atingir a média.`
                      : `acima da média dos aprovados — posição competitiva.`
                  }
                </>
              ) : 'Nota ponderada não disponível para comparação.'}
            </Text>
            {sisuAnalysis.notaPonderadaAtual != null && report.perfilAprovados.notaP25 > 0 ? (
              <Text style={s.mdText}>
                <Text style={s.textBold}>Meta prática:</Text> para trabalhar com uma chance mais estável de aprovação, o alvo mínimo é {fmtNota(report.perfilAprovados.notaP25)} pontos. Hoje faltam {fmtNota(Math.max(0, report.perfilAprovados.notaP25 - (sisuAnalysis.notaPonderadaAtual ?? 0)))} pontos para esse patamar.
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={s.mdH2}>## Onde investir</Text>
        <Text style={s.mdMuted}>
          Os conteúdos abaixo foram priorizados pelo cruzamento entre erros do simulado e incidência histórica no ENEM. A leitura correta não é “estudar tudo”, e sim começar pelo que tem mais erro, mais incidência e mais retorno em nota final.
        </Text>

        {groupedHabs.map(({ area, totalErros, items }) => {
          const triAtual = triMap[area] ?? null
          const peso = sortedRoi.find((r) => r.sigla === area)
          const questoesRecomendadas = items.flatMap((h) => h.questoesRecomendadas).length

          return (
            <View key={area} style={[s.areaSection, { borderLeftColor: AREA_COLORS[area] ?? '#9ca3af' }]}>
              <Text style={[s.mdH3, { color: AREA_COLORS[area] ?? '#111827' }]}>### {AREA_NOMES[area] ?? area}</Text>
              <Text style={s.mdText}>
                Você concentrou {totalErros} erros nesta área.
                {triAtual != null ? ` A TRI atual é ${fmtNota(triAtual)}.` : ''}
                {peso ? ` No SISU deste curso, o peso é ${peso.peso} e cada +1 ponto TRI vale +${peso.valorPontoFinal.toFixed(2)} na nota final.` : ''}
              </Text>
              {items.map((hab) => {
                const prio = prioLabel(hab.score)
                return (
                  <Text key={hab.identificador} style={s.mdBullet}>
                    - <Text style={[s.textBold, { color: prio.color }]}>{prio.text}</Text> · {hab.pedagogicalLabel} — {hab.totalErros} erros, incidência {fmtPct(hab.percentualIncidencia)}.
                  </Text>
                )
              })}
              {questoesRecomendadas > 0 ? (
                <Text style={s.mdMuted}>
                  Treino recomendado: {items.filter((h) => h.questoesRecomendadas.length > 0).map((h) => {
                    const label = h.pedagogicalLabel
                    const qs = h.questoesRecomendadas.slice(0, 3)
                    return `${label} → ${qs.map((q) => `ENEM ${q.ano} (${dificuldadeSimples(q.dificuldade)})`).join(', ')}`
                  }).join(' | ')}. Caderno completo com imagens no PDF separado.
                </Text>
              ) : null}
            </View>
          )
        })}

        <Text style={s.mdH2}>## Questões que mais custaram no TRI</Text>
        <Text style={s.mdMuted}>
          No modelo TRI, errar uma questão fácil penaliza muito mais do que errar uma difícil. Abaixo, as questões onde você perdeu mais pontos por serem consideradas fáceis ou médias pela banca.
        </Text>

        {allDesp.length > 0 ? (
          <View>
            <Text style={[s.mdText, { marginBottom: 4 }]}>
              Você errou <Text style={s.textRed}>{allDesp.length} questões fáceis</Text> e {report.parametrosTRI.errosEsperados.length} questões difíceis. As questões fáceis custam significativamente mais pontos no TRI porque o modelo assume que alunos com sua proficiência deveriam acertá-las. Cada questão fácil errada custou em média ~{despStats.media} pontos (variando de {despStats.min} a {despStats.max}), totalizando ~{despStats.total} pontos perdidos em desperdícios{report.parametrosTRI.errosEsperados.length > 0 ? `, enquanto cada questão difícil errada custou em média ~${errosEspStats.media} pontos` : ''}.
            </Text>

            {allDesp.slice(0, 12).map((item, i) => {
              const habInfo = findHabForQ(item.questionNumber, report)
              const conteudo = habInfo ? getConteudoDidatico(habInfo) : AREA_NOMES[item.area] ?? item.area
              const impacto = estimarImpacto(item)
              const areaNome = AREA_NOMES[item.area] ?? item.area

              return (
                <Text key={item.questionNumber} style={s.mdOrdered} wrap={false}>
                  <Text style={s.textBold}>{i + 1}. </Text>Questão {item.questionNumber} ({areaNome}) — {conteudo}. Dificuldade {dificuldadeSimples(item.paramDificuldade)} (b = {item.paramDificuldade.toFixed(2)}), discriminação {item.paramDiscriminacao.toFixed(2)} e <Text style={s.textRed}>impacto estimado de ~{impacto} pontos perdidos</Text>.
                </Text>
              )
            })}

            {allDesp.length > 12 ? (
              <Text style={s.mdMuted}>... e mais {allDesp.length - 12} desperdícios não listados nesta versão resumida.</Text>
            ) : null}

            <View style={[s.divider, { marginTop: 4 }]} />

            <Text style={[s.mdText, { marginTop: 2 }]}>
              <Text style={s.textBold}>Leitura prática: </Text>
              Antes de estudar conteúdos novos, revise os conteúdos das questões fáceis que você errou. No TRI, acertar as fáceis é mais rentável do que acertar as difíceis. Foque especialmente em: {
                [...new Set(allDesp.slice(0, 5).map((item) => {
                  const habInfo = findHabForQ(item.questionNumber, report)
                  return habInfo ? getConteudoDidatico(habInfo) : AREA_NOMES[item.area] ?? item.area
                }))].join(', ')
              }.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={[s.mdText, { marginBottom: 3 }]}>
              Este simulado não usa questões ENEM oficiais, então não temos os parâmetros TRI individuais de cada questão. Porém, com base na nota TRI por área e quantidade de erros, a análise indica:
            </Text>
            {(['LC', 'CH', 'CN', 'MT'] as const).map(area => {
              const errosArea = errosByArea[area] ?? 0
              if (errosArea === 0) return null
              const tri = triMap[area]
              const aproveitamento = Math.round(((45 - errosArea) / 45) * 100)
              return (
                <Text key={area} style={s.mdBullet} wrap={false}>
                  - <Text style={s.textBold}>{AREA_NOMES[area]}:</Text> {errosArea} erros ({aproveitamento}% de aproveitamento){tri != null ? `, TRI ${tri.toFixed(0)}` : ''}.{errosArea > 15 ? ' Desempenho crítico.' : errosArea > 8 ? ' Abaixo do esperado.' : ' Razoável.'}
                </Text>
              )
            })}
            <Text style={[s.mdText, { marginTop: 2 }]}>
              <Text style={s.textBold}>Leitura prática: </Text>
              Foque nas áreas com mais erros e menor TRI. Revise os conteúdos básicos antes de avançar para conteúdos difíceis.
              {topConteudos.length > 0 ? ` Priorize: ${topConteudos.slice(0, 5).map(c => c.conteudo).join(', ')}.` : ''}
            </Text>
          </View>
        )}

        <View style={s.divider} />

        <Text style={s.mdH2}>## Base usada no relatório</Text>
        <Text style={s.mdBullet}>- Itens ENEM com parâmetros TRI: 3.686 itens de 2010 a 2024.</Text>
        <Text style={s.mdBullet}>- Notas de corte SISU: 330.809 registros históricos.</Text>
        <Text style={s.mdBullet}>- Lista de aprovados SISU: 419.974 registros com nota final.</Text>
        <Text style={s.mdBullet}>- Matriz de referência ENEM: 120 habilidades em 4 áreas.</Text>
        {report.incidenciaHistorica ? (
          <Text style={s.mdBullet}>- Incidência histórica de habilidades: período {report.incidenciaHistorica.periodoAnalisado.inicio}-{report.incidenciaHistorica.periodoAnalisado.fim}.</Text>
        ) : null}
        <Text style={s.mdBullet}>- Relatório determinístico: nenhum dado deste documento foi gerado por IA.</Text>
        <Text style={s.badgeLine}>N amostral desta leitura: 1 aluno, 1 simulado, 4 áreas objetivas e {sortedHabs.length} habilidades críticas priorizadas.</Text>

        <FooterPDF />
      </Page>
    </Document>
  )
}

function FooterPDF() {
  return (
    <View style={s.footer} fixed>
      <Image src="/logo-xtri.png" style={s.footerLogo} />
      <Text style={s.footerText}>
        Alexandre Emerson M Araújo · XTRI EdTECH · @xandaoxtri · @xtrienem · xtri.online
      </Text>
    </View>
  )
}
