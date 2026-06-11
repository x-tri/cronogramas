import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReportData, HabilidadeCritica, QuestaoRecomendada, AreaSigla } from '../../types/report'
import {
  buildQuestionImageLayoutKey,
  DEFAULT_QUESTION_IMAGE_LAYOUT,
  type QuestionImageLayout,
} from '../../services/question-image-layout'
import {
  buildAreaQuestionRows,
  COLUMN_IMAGE_HEIGHT_PT,
  isValidImageUrl,
  shouldRenderVisualImage,
  type AreaQuestionRow,
} from './pdf-caderno-layout'
import {
  summarizeAreaFocus,
} from '../../services/question-content-label'
import {
  normalizeAlternativeText,
  sanitizeQuestionText,
  summarizeTriCalibration,
} from './pdf-question-text'

const AREA_COLORS: Record<string, string> = {
  CN: '#10b981', CH: '#f97316', LC: '#3b82f6', MT: '#ef4444',
}
const AREA_NOMES: Record<string, string> = {
  CN: 'Ciencias da Natureza', CH: 'Ciencias Humanas',
  LC: 'Linguagens e Codigos', MT: 'Matematica',
}
const AREA_BG: Record<string, string> = {
  CN: '#ecfdf5', CH: '#fff7ed', LC: '#eff6ff', MT: '#fef2f2',
}

/** Trunca texto de apoio a ~15 linhas (aprox. 900 chars) */
function truncateTextoApoio(txt: string, maxChars = 900): string {
  if (txt.length <= maxChars) return txt
  return txt.slice(0, maxChars).trimEnd() + ' (...)'
}

function groupByArea(
  habs: ReadonlyArray<HabilidadeCritica>,
): ReadonlyArray<{ area: AreaSigla; items: ReadonlyArray<HabilidadeCritica> }> {
  const order: AreaSigla[] = ['LC', 'CH', 'CN', 'MT']
  const map = new Map<AreaSigla, HabilidadeCritica[]>()
  for (const h of habs) {
    if (h.questoesRecomendadas.length === 0) continue
    const existing = map.get(h.area)
    if (existing) { existing.push(h) } else { map.set(h.area, [h]) }
  }
  return order.filter(a => map.has(a)).map(area => ({ area, items: map.get(area)! }))
}

interface RenderRow {
  readonly kind: AreaQuestionRow['kind']
  readonly items: ReadonlyArray<{ numero: number; questao: QuestaoRecomendada } | null>
}

/**
 * Monta as linhas por área (pareadas por altura estimada — pdf-caderno-layout)
 * e numera as questões NA ORDEM VISUAL final, para numeração e gabarito
 * acompanharem a leitura.
 */
function buildCadernoRenderModel(
  grouped: ReturnType<typeof groupByArea>,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): {
  areasRender: Array<{
    area: AreaSigla
    items: ReadonlyArray<HabilidadeCritica>
    renderRows: RenderRow[]
  }>
  todasQuestoes: Array<{ numero: number; questao: QuestaoRecomendada; area: AreaSigla }>
} {
  const todasQuestoes: Array<{ numero: number; questao: QuestaoRecomendada; area: AreaSigla }> = []
  let contador = 1

  const areasRender = grouped.map(({ area, items }) => {
    const questoesDaArea = items.flatMap((hab) => hab.questoesRecomendadas)
    const rows = buildAreaQuestionRows(questoesDaArea, imageLayoutByQuestionKey)
    const renderRows: RenderRow[] = rows.map((row) => ({
      kind: row.kind,
      items: row.items.map((questao) => {
        if (!questao) return null
        const item = { numero: contador, questao }
        todasQuestoes.push({ ...item, area })
        contador += 1
        return item
      }),
    }))
    return { area, items, renderRows }
  })

  return { areasRender, todasQuestoes }
}

const M = 28
const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, paddingTop: 28, paddingBottom: 36, paddingHorizontal: M, backgroundColor: '#ffffff', color: '#1d1d1f' },
  // Header compacto
  headerBg: { backgroundColor: '#1d1d1f', marginHorizontal: -M, marginTop: -28, paddingHorizontal: M, paddingTop: 14, paddingBottom: 10 },
  h1: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: -0.3 },
  headerSub: { fontSize: 7.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  // Area header compacto
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#d1d0cb' },
  areaDot: { width: 6, height: 6, borderRadius: 3 },
  areaName: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  areaInfo: { fontSize: 7, color: '#6b7280', marginLeft: 'auto' },
  questaoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  questaoCol: { width: '48.7%' },
  questaoColSpacer: { width: '48.7%' },
  questaoFull: { width: '100%' },
  // Questao container
  questaoBox: { borderWidth: 0.5, borderColor: '#e3e2e0', borderRadius: 4, overflow: 'hidden' },
  questaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  questaoNumero: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d1d1f' },
  questaoTri: { fontSize: 7, fontFamily: 'Helvetica', color: '#71717a' },
  // Texto de apoio
  textoApoioBox: { marginHorizontal: 8, marginBottom: 4, paddingLeft: 6, paddingVertical: 4, paddingRight: 4, borderLeftWidth: 3, borderLeftColor: '#3b82f6', backgroundColor: '#f7f6f3', borderRadius: 2 },
  textoApoio: { fontSize: 7, fontStyle: 'italic', color: '#374151', lineHeight: 1.5 },
  // Imagem da questao
  questaoImagemWrap: {
    marginHorizontal: 8,
    marginBottom: 6,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  questaoImagem: {
    objectFit: 'contain',
  },
  // Enunciado
  enunciadoBox: { marginHorizontal: 8, marginBottom: 4 },
  enunciado: { fontSize: 8, color: '#1d1d1f', lineHeight: 1.5 },
  // Alternativas
  alternativasBox: { marginHorizontal: 8, marginBottom: 6 },
  alternativaRow: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-start' },
  alternativaLetra: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', width: 16 },
  alternativaTexto: { fontSize: 8, color: '#1d1d1f', flex: 1, lineHeight: 1.4 },
  alternativaImagem: { width: 128, height: 28, objectFit: 'contain' },
  // Sem conteudo
  semConteudoBox: { paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center' },
  semConteudoText: { fontSize: 7.5, color: '#9ca3af', fontStyle: 'italic' },
  // Gabarito
  gabTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  gabSubtitle: { fontSize: 7.5, color: '#6b7280', marginBottom: 8, lineHeight: 1.5 },
  gabTHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#9ca3af', paddingBottom: 2, marginBottom: 1 },
  gabTh: { fontSize: 6.5, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  gabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f1ef', paddingVertical: 3, alignItems: 'center' },
  gabNum: { width: 20, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  gabAno: { width: 40, fontSize: 7.5, color: '#6b7280' },
  gabArea: { width: 24, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  gabSuaResp: { width: 28, fontSize: 8, textAlign: 'center', color: '#9ca3af' },
  gabResp: { width: 28, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#10b981' },
  // Instrucao e footer
  instrucao: { fontSize: 7.5, color: '#374151', lineHeight: 1.6, marginBottom: 4 },
  instrucaoBold: { fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 12, left: M, right: M, flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 0.5, borderTopColor: '#e3e2e0', paddingTop: 3 },
  footerLogo: { width: 12, height: 12 },
  footerText: { fontSize: 6, color: '#9ca3af', flex: 1 },
  // Header logo
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLogo: { width: 32, height: 32, borderRadius: 5, backgroundColor: '#ffffff', padding: 2 },
})

interface Props {
  readonly report: ReportData
  readonly nomeAluno: string
  readonly imageLayoutByQuestionKey?: Readonly<Record<string, QuestionImageLayout>>
}

const FULL_IMAGE_WIDTH_PT = 440
const FULL_IMAGE_HEIGHT_PT = 260
const COLUMN_IMAGE_WIDTH_PT = 210

export function QuestoesRecomendadasPDF({
  report,
  nomeAluno,
  imageLayoutByQuestionKey = {},
}: Props) {
  const hoje = new Date(report.computedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const grouped = groupByArea(report.questoesRecomendadas.habilidadesCriticas)

  const { areasRender, todasQuestoes } = buildCadernoRenderModel(
    grouped,
    imageLayoutByQuestionKey,
  )

  const totalQuestoes = todasQuestoes.length

  return (
    <Document title={`Caderno de Questoes -- ${nomeAluno}`}>
      {/* PAGINAS DE QUESTOES -- por area */}
      {areasRender.map(({ area, items, renderRows }, groupIdx) => {
        const areaColor = AREA_COLORS[area] ?? '#6b7280'
        const areaBg = AREA_BG[area] ?? '#f9fafb'
        const totalErrosArea = items.reduce((sum, h) => sum + h.totalErros, 0)

        const questoesDaArea = todasQuestoes.filter(tq => tq.area === area)
        const areaFocus = summarizeAreaFocus(
          questoesDaArea.map((item) => item.questao),
        )
        // Cabeçalho honesto: só conta como "calibrada" questão com param_b
        // real fora do fallback de área (dificuldade textual)
        const calibration = summarizeTriCalibration(
          questoesDaArea.map((item) => item.questao),
        )
        const calibrationLabel =
          calibration.calibradas > 0
            ? `${calibration.calibradas} calibradas ao seu TRI${
                calibration.complementares > 0
                  ? ` + ${calibration.complementares} da área`
                  : ''
              }`
            : `${calibration.complementares} questoes da área`

        return (
          <Page key={area} size="A4" style={s.page}>
            {/* Header apenas na primeira area */}
            {groupIdx === 0 ? (
              <View style={s.headerBg}>
                <View style={s.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.h1}>Caderno de Questoes Recomendadas</Text>
                    <Text style={s.headerSub}>{nomeAluno} · {totalQuestoes} questoes · {hoje}</Text>
                  </View>
                  <Image src="/logo-xtri.png" style={s.headerLogo} />
                </View>
              </View>
            ) : null}

            {/* Area header */}
            <View style={s.areaHead}>
              <View style={[s.areaDot, { backgroundColor: areaColor }]} />
              <Text style={[s.areaName, { color: areaColor }]}>{AREA_NOMES[area] ?? area}</Text>
              <Text style={s.areaInfo}>
                {totalErrosArea} erros · {areaFocus.label
                  ? `foco principal: ${areaFocus.label}`
                  : 'foco por habilidade'} · {calibrationLabel}
              </Text>
            </View>

            {/* Layout híbrido: texto em duas colunas, questões visuais em largura total */}
            {renderRows.map((row) => (
              <View
                key={row.items
                  .flatMap((item) =>
                    item ? [`${item.numero}-${item.questao.coItem}`] : [],
                  )
                  .join('-')}
                style={s.questaoRow}
                wrap={false}
              >
                {row.kind === 'full' && row.items[0] ? (
                  <View style={s.questaoFull}>
                    <QuestionCard
                      area={area}
                      areaBg={areaBg}
                      areaColor={areaColor}
                      compactVisualImage={false}
                      imageLayoutByQuestionKey={imageLayoutByQuestionKey}
                      numero={row.items[0].numero}
                      questao={row.items[0].questao}
                    />
                  </View>
                ) : row.items[0] ? (
                  <>
                    <View style={s.questaoCol}>
                      <QuestionCard
                        area={area}
                        areaBg={areaBg}
                        areaColor={areaColor}
                        compactVisualImage={true}
                        imageLayoutByQuestionKey={imageLayoutByQuestionKey}
                        numero={row.items[0].numero}
                        questao={row.items[0].questao}
                      />
                    </View>
                    {row.items[1] ? (
                      <View style={s.questaoCol}>
                        <QuestionCard
                          area={area}
                          areaBg={areaBg}
                          areaColor={areaColor}
                          compactVisualImage={true}
                          imageLayoutByQuestionKey={imageLayoutByQuestionKey}
                          numero={row.items[1].numero}
                          questao={row.items[1].questao}
                        />
                      </View>
                    ) : (
                      <View style={s.questaoColSpacer} />
                    )}
                  </>
                ) : null}
              </View>
            ))}

            <FooterPDF />
          </Page>
        )
      })}

      {/* ULTIMA PAGINA: GABARITO */}
      <Page size="A4" style={s.page}>
        <Text style={s.gabTitle}>Gabarito</Text>
        <Text style={s.gabSubtitle}>
          Confira suas respostas. Marque os acertos e os erros. Foque em revisar os erros das questoes faceis -- elas custam mais pontos no TRI.
        </Text>

        {/* Header tabela */}
        <View style={s.gabTHeader}>
          <Text style={[s.gabTh, { width: 20, textAlign: 'center' }]}>#</Text>
          <Text style={[s.gabTh, { width: 40 }]}>ANO</Text>
          <Text style={[s.gabTh, { width: 24, textAlign: 'center' }]}>AREA</Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.gabTh, { width: 28, textAlign: 'center' }]}>SUA</Text>
          <Text style={[s.gabTh, { width: 28, textAlign: 'center' }]}>GAB.</Text>
        </View>

        {todasQuestoes.map(({ numero, questao }) => (
          <View key={`gab-${numero}`} style={s.gabRow} wrap={false}>
            <Text style={s.gabNum}>{numero}</Text>
            <Text style={s.gabAno}>ENEM {questao.ano}</Text>
            <Text style={[s.gabArea, { color: AREA_COLORS[questao.area] ?? '#6b7280' }]}>{questao.area}</Text>
            <View style={{ flex: 1 }} />
            <Text style={s.gabSuaResp}>___</Text>
            <Text style={s.gabResp}>{questao.gabarito ?? '--'}</Text>
          </View>
        ))}

        <View style={{ marginTop: 10 }}>
          <Text style={s.instrucao}>
            <Text style={s.instrucaoBold}>Resultado: </Text>
            _____ acertos de {totalQuestoes} questoes (_____ % de aproveitamento).
          </Text>
          <Text style={[s.instrucao, { marginTop: 4 }]}>
            Se acertou menos de 60% em alguma area, revise o conteudo antes do proximo simulado. Se acertou mais de 80%, avance para questoes mais dificeis.
          </Text>
        </View>

        <FooterPDF />
      </Page>
    </Document>
  )
}

interface QuestionCardProps {
  readonly area: AreaSigla
  readonly areaBg: string
  readonly areaColor: string
  readonly compactVisualImage?: boolean
  readonly imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>
  readonly numero: number
  readonly questao: QuestaoRecomendada
}

function QuestionCard({
  area,
  areaBg,
  areaColor,
  compactVisualImage = false,
  imageLayoutByQuestionKey,
  numero,
  questao,
}: QuestionCardProps) {
  const textoApoioLimpo = sanitizeQuestionText(questao.textoApoio)
  const enunciadoLimpo = sanitizeQuestionText(questao.enunciado)
  const imagemValida = shouldRenderVisualImage(questao)
  const imageLayout =
    imageLayoutByQuestionKey[buildQuestionImageLayoutKey(questao)] ??
    DEFAULT_QUESTION_IMAGE_LAYOUT
  const maxImageWidth = compactVisualImage ? COLUMN_IMAGE_WIDTH_PT : FULL_IMAGE_WIDTH_PT
  const maxImageHeight = compactVisualImage ? COLUMN_IMAGE_HEIGHT_PT : FULL_IMAGE_HEIGHT_PT
  const imageWidth = Math.min(imageLayout.width, maxImageWidth)
  const imageHeight = Math.min(imageLayout.height, maxImageHeight)

  return (
    <View style={[s.questaoBox, { borderTopWidth: 2, borderTopColor: areaColor }]}>
      <View style={[s.questaoHeader, { backgroundColor: areaBg }]}>
        <Text style={s.questaoNumero}>
          Questao {numero} -- ENEM {questao.ano}
          {questao.posicaoCaderno ? ` -- Q${questao.posicaoCaderno}` : ''}
          {' -- '}{area}
        </Text>
        <Text style={s.questaoTri}>
          {/* dificuldade pode ser 0 quando o algoritmo nao pegou param_b
              (ex: ENEM 2025 sem microdados); mostra travessao nesses casos */}
          TRI: {questao.dificuldade && questao.dificuldade !== 0
            ? questao.dificuldade.toFixed(2)
            : '—'}
        </Text>
      </View>

      {textoApoioLimpo ? (
        <View style={s.textoApoioBox}>
          <Text style={s.textoApoio}>
            {truncateTextoApoio(textoApoioLimpo)}
          </Text>
        </View>
      ) : null}

      {imagemValida ? (
        <View style={s.questaoImagemWrap}>
          <Image
            src={questao.imagemUrl as string}
            style={[
              s.questaoImagem,
              {
                width: imageWidth,
                height: imageHeight,
              },
            ]}
          />
        </View>
      ) : null}

      {enunciadoLimpo ? (
        <View style={s.enunciadoBox}>
          <Text style={s.enunciado}>{enunciadoLimpo}</Text>
        </View>
      ) : !textoApoioLimpo ? (
        // So mostra fallback "Item NNNNN" se NEM enunciado NEM texto de apoio
        // existirem. Quando context (textoApoio) ja tem o conteudo da questao,
        // a label tecnica e ruido — alternativas + texto de apoio bastam.
        <View style={s.semConteudoBox}>
          <Text style={s.semConteudoText}>
            Questao ENEM {questao.ano} -- Item {questao.coItem} -- {AREA_NOMES[questao.area] ?? questao.area}
          </Text>
        </View>
      ) : null}

      {questao.alternativas && questao.alternativas.length > 0 ? (
        <View style={s.alternativasBox}>
          {questao.alternativas.map((alt) => (
            <View key={alt.letra} style={s.alternativaRow}>
              <Text style={s.alternativaLetra}>{alt.letra})</Text>
              {isValidImageUrl(alt.imagemUrl) ? (
                <Image src={alt.imagemUrl as string} style={s.alternativaImagem} />
              ) : (
                <Text style={s.alternativaTexto}>
                  {normalizeAlternativeText(alt.letra, alt.texto)}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
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
