import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReportData, HabilidadeCritica, QuestaoRecomendada, AreaSigla } from '../../types/report'
import { shouldRenderQuestionImage } from '../../services/question-delivery'
import {
  buildQuestionImageLayoutKey,
  type QuestionImageLayout,
} from '../../services/question-image-layout'
import {
  summarizeAreaFocus,
} from '../../services/question-content-label'

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

/**
 * Valida se a URL é segura pra ser usada como <Image src={...}> no @react-pdf/renderer.
 * O renderer exige extensão reconhecida (png/jpg/jpeg/gif/bmp/webp) no pathname.
 * URLs markdown, relative, data URLs mal-formadas ou sem extensão são rejeitadas.
 */
function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return /\.(png|jpe?g|gif|bmp|webp)$/i.test(u.pathname)
  } catch {
    return false
  }
}

/**
 * Remove literais markdown `![alt](url)` do texto — essas tags vazam do banco como
 * texto cru e aparecem no PDF como `![imagem](https://…)`. Também colapsa múltiplos
 * espaços/quebras resultantes da remoção.
 */
function stripMarkdownImages(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  alternativaRow: { flexDirection: 'row', marginBottom: 2 },
  alternativaLetra: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', width: 16 },
  alternativaTexto: { fontSize: 8, color: '#1d1d1f', flex: 1, lineHeight: 1.4 },
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

interface QuestionRenderItem {
  readonly numero: number
  readonly questao: QuestaoRecomendada
  readonly area: AreaSigla
}

const MAX_COLUMN_VISUAL_WIDTH_PT = 360
const MAX_COLUMN_VISUAL_HEIGHT_PT = 320
const COLUMN_IMAGE_WIDTH_PT = 210
const COLUMN_IMAGE_HEIGHT_PT = 190

type AreaQuestionRow =
  | {
      readonly kind: 'full'
      readonly items: readonly [QuestionRenderItem]
    }
  | {
      readonly kind: 'columns'
      readonly items: readonly [QuestionRenderItem, QuestionRenderItem | null]
    }

function shouldRenderVisualImage(
  question: QuestaoRecomendada,
): boolean {
  return (
    question.requiresVisualContext &&
    isValidImageUrl(question.imagemUrl) &&
    shouldRenderQuestionImage(question)
  )
}

function shouldUseFullWidthQuestion(
  question: QuestaoRecomendada,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): boolean {
  if (!shouldRenderVisualImage(question)) {
    return false
  }

  const layout = imageLayoutByQuestionKey[buildQuestionImageLayoutKey(question)]
  if (!layout) {
    return true
  }

  return (
    layout.width > MAX_COLUMN_VISUAL_WIDTH_PT ||
    layout.height > MAX_COLUMN_VISUAL_HEIGHT_PT
  )
}

function buildAreaQuestionRows(
  questions: ReadonlyArray<QuestionRenderItem>,
  imageLayoutByQuestionKey: Readonly<Record<string, QuestionImageLayout>>,
): AreaQuestionRow[] {
  const rows: AreaQuestionRow[] = []

  for (let index = 0; index < questions.length; index += 1) {
    const current = questions[index]
    if (shouldUseFullWidthQuestion(current.questao, imageLayoutByQuestionKey)) {
      rows.push({ kind: 'full', items: [current] })
      continue
    }

    const next = questions[index + 1]
    if (next && !shouldUseFullWidthQuestion(next.questao, imageLayoutByQuestionKey)) {
      rows.push({ kind: 'columns', items: [current, next] })
      index += 1
      continue
    }

    rows.push({ kind: 'columns', items: [current, null] })
  }

  return rows
}

export function QuestoesRecomendadasPDF({
  report,
  nomeAluno,
  imageLayoutByQuestionKey = {},
}: Props) {
  const hoje = new Date(report.computedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const grouped = groupByArea(report.questoesRecomendadas.habilidadesCriticas)

  // Numerar sequencialmente todas as questoes
  const todasQuestoes: Array<{ numero: number; questao: QuestaoRecomendada; area: AreaSigla }> = []
  let contador = 1
  for (const { area, items } of grouped) {
    for (const hab of items) {
      for (const q of hab.questoesRecomendadas) {
        todasQuestoes.push({
          numero: contador,
          questao: q,
          area,
        })
        contador++
      }
    }
  }

  const totalQuestoes = todasQuestoes.length

  return (
    <Document title={`Caderno de Questoes -- ${nomeAluno}`}>
      {/* PAGINAS DE QUESTOES -- por area */}
      {grouped.map(({ area, items }, groupIdx) => {
        const areaColor = AREA_COLORS[area] ?? '#6b7280'
        const areaBg = AREA_BG[area] ?? '#f9fafb'
        const totalArea = items.reduce((sum, h) => sum + h.questoesRecomendadas.length, 0)
        const totalErrosArea = items.reduce((sum, h) => sum + h.totalErros, 0)

        // Coletar questoes da area
        const questoesDaArea = todasQuestoes.filter(tq => tq.area === area)
        const areaFocus = summarizeAreaFocus(
          questoesDaArea.map((item) => item.questao),
        )
        const rows = buildAreaQuestionRows(questoesDaArea, imageLayoutByQuestionKey)

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
                  ? `foco principal confirmado: ${areaFocus.label}`
                  : 'foco principal não confirmado'} · {totalArea} questoes calibradas ao seu TRI
              </Text>
            </View>

            {/* Layout híbrido: texto em duas colunas, questões visuais em largura total */}
            {rows.map((row) => (
              <View
                key={row.items
                  .flatMap((item) =>
                    item ? [`${item.numero}-${item.questao.coItem}`] : [],
                  )
                  .join('-')}
                style={s.questaoRow}
                wrap={false}
              >
                {row.kind === 'full' ? (
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
                ) : (
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
                )}
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
  const textoApoioLimpo = stripMarkdownImages(questao.textoApoio)
  const enunciadoLimpo = stripMarkdownImages(questao.enunciado)
  const imagemValida = shouldRenderVisualImage(questao)
  const imageLayout = imageLayoutByQuestionKey[buildQuestionImageLayoutKey(questao)]
  const imageWidth = compactVisualImage
    ? Math.min(imageLayout?.width ?? COLUMN_IMAGE_WIDTH_PT, COLUMN_IMAGE_WIDTH_PT)
    : (imageLayout?.width ?? 260)
  const imageHeight = compactVisualImage
    ? Math.min(imageLayout?.height ?? COLUMN_IMAGE_HEIGHT_PT, COLUMN_IMAGE_HEIGHT_PT)
    : (imageLayout?.height ?? 160)

  return (
    <View style={[s.questaoBox, { borderTopWidth: 2, borderTopColor: areaColor }]}>
      <View style={[s.questaoHeader, { backgroundColor: areaBg }]}>
        <Text style={s.questaoNumero}>
          Questao {numero} -- ENEM {questao.ano}
          {questao.posicaoCaderno ? ` -- Q${questao.posicaoCaderno}` : ''}
          {' -- '}{area}
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
      ) : (
        <View style={s.semConteudoBox}>
          <Text style={s.semConteudoText}>
            Questao ENEM {questao.ano} -- Item {questao.coItem} -- {AREA_NOMES[questao.area] ?? questao.area}
          </Text>
        </View>
      )}

      {questao.alternativas && questao.alternativas.length > 0 ? (
        <View style={s.alternativasBox}>
          {questao.alternativas.map((alt) => (
            <View key={alt.letra} style={s.alternativaRow}>
              <Text style={s.alternativaLetra}>{alt.letra})</Text>
              <Text style={s.alternativaTexto}>{alt.texto}</Text>
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
