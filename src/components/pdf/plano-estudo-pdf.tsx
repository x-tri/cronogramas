import { Document, Page, View, Text } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import type { PlanoEstudo } from '../../services/maritaca'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#0071e3',
  },
  headerLeft: { flexDirection: 'column', gap: 2 },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 9, color: '#6b7280' },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  headerBrand: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0071e3' },
  headerDate: { fontSize: 8, color: '#9ca3af' },
  // Meta badges row
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 3,
    borderLeftColor: '#0071e3',
  },
  metaBadgeLabel: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaBadgeValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', marginTop: 1 },
  // Resumo
  resumoBox: {
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 3,
    borderLeftColor: '#0071e3',
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  resumoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#0071e3', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resumoText: { fontSize: 9, color: '#1e40af', lineHeight: 1.5 },
  // Área card
  areaCard: {
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e3e2e0',
    overflow: 'hidden',
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f7f6f3',
  },
  areaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  areaDot: { width: 8, height: 8, borderRadius: 4 },
  areaNome: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1d1d1f' },
  areaTRI: {
    fontSize: 8,
    color: '#6b7280',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  prioridadeTag: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  areaBody: { padding: 10 },
  // Tópicos
  topicosLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  topicosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  topicoBadge: {
    fontSize: 7.5,
    color: '#4b5563',
    backgroundColor: '#f1f1ef',
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  // Estratégia
  estrategiaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  estrategiaText: { fontSize: 8.5, color: '#374151', lineHeight: 1.5, marginBottom: 8 },
  // Ações
  acoesLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  acaoRow: { flexDirection: 'row', gap: 5, marginBottom: 3, alignItems: 'flex-start' },
  acaoBullet: { fontSize: 8, color: '#9ca3af', marginTop: 1 },
  acaoText: { fontSize: 8, color: '#4b5563', lineHeight: 1.4, flex: 1 },
  // Divider
  divider: { height: 1, backgroundColor: '#e3e2e0', marginVertical: 8 },
  // Semanas e meta
  bottomRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  bottomBox: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e3e2e0',
  },
  bottomBoxLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bottomBoxText: { fontSize: 9, color: '#37352f', lineHeight: 1.5 },
  // Recomendação
  recomBox: {
    backgroundColor: '#f5f3ff',
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  recomLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  recomText: { fontSize: 9, color: '#5b21b6', lineHeight: 1.5 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e3e2e0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#c1c0bb' },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#37352f', marginBottom: 8, marginTop: 4 },
})

const PRIORIDADE_STYLES = {
  alta: { bg: '#fef2f2', text: '#b91c1c' },
  media: { bg: '#fff7ed', text: '#c2410c' },
  baixa: { bg: '#f0fdf4', text: '#047857' },
}
const PRIORIDADE_LABELS = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

type PlanoEstudoPDFProps = {
  plano: PlanoEstudo
  nomeAluno: string | null
  simuladoTitle: string
}

export function PlanoEstudoPDF({ plano, nomeAluno, simuladoTitle }: PlanoEstudoPDFProps) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Document title={`Plano de Estudos — ${nomeAluno ?? 'Aluno'}`}>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Plano de Estudos ENEM</Text>
            <Text style={styles.headerSubtitle}>{nomeAluno ?? 'Aluno(a)'} · {simuladoTitle}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerBrand}>XTRI</Text>
            <Text style={styles.headerDate}>{hoje}</Text>
          </View>
        </View>

        {/* Meta badges */}
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeLabel}>Distribuição Semanal</Text>
            <Text style={styles.metaBadgeValue}>{plano.semanas}</Text>
          </View>
          {plano.metaTRI && (
            <View style={[styles.metaBadge, { borderLeftColor: '#8b5cf6', backgroundColor: '#f5f3ff' }]}>
              <Text style={[styles.metaBadgeLabel, { color: '#7c3aed' }]}>Meta próximo simulado</Text>
              <Text style={[styles.metaBadgeValue, { color: '#6d28d9' }]}>{plano.metaTRI}</Text>
            </View>
          )}
        </View>

        {/* Resumo */}
        <View style={styles.resumoBox}>
          <Text style={styles.resumoLabel}>Análise do Desempenho</Text>
          <Text style={styles.resumoText}>{plano.resumo}</Text>
        </View>

        {/* Seção áreas */}
        <Text style={styles.sectionTitle}>Plano por Área de Conhecimento</Text>

        {plano.porArea
          .slice()
          .sort((a, b) => {
            const order = { alta: 0, media: 1, baixa: 2 }
            return order[a.prioridade] - order[b.prioridade]
          })
          .map((area) => {
            const prio = PRIORIDADE_STYLES[area.prioridade] ?? PRIORIDADE_STYLES.media
            const prioLabel = PRIORIDADE_LABELS[area.prioridade]
            return (
              <View key={area.area} style={styles.areaCard}>
                {/* Header da área */}
                <View style={styles.areaHeader}>
                  <View style={styles.areaHeaderLeft}>
                    <View style={[styles.areaDot, { backgroundColor: area.cor }]} />
                    <Text style={styles.areaNome}>{area.area}</Text>
                    {area.nota && <Text style={styles.areaTRI}>TRI {area.nota}</Text>}
                  </View>
                  <Text style={[styles.prioridadeTag, { backgroundColor: prio.bg, color: prio.text }]}>
                    Prioridade {prioLabel}
                  </Text>
                </View>

                {/* Body */}
                <View style={styles.areaBody}>
                  {/* Tópicos */}
                  <Text style={styles.topicosLabel}>Tópicos a Revisar</Text>
                  <View style={styles.topicosRow}>
                    {area.topicos.map((t) => (
                      <Text key={t} style={styles.topicoBadge}>{t}</Text>
                    ))}
                  </View>

                  {/* Estratégia */}
                  <Text style={styles.estrategiaLabel}>Estratégia</Text>
                  <Text style={styles.estrategiaText}>{area.estrategia}</Text>

                  {/* Ações */}
                  {area.acoes && area.acoes.length > 0 && (
                    <>
                      <Text style={styles.acoesLabel}>Ações Concretas</Text>
                      {area.acoes.map((acao, i) => (
                        <View key={i} style={styles.acaoRow}>
                          <Text style={styles.acaoBullet}>→</Text>
                          <Text style={styles.acaoText}>{acao}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              </View>
            )
          })}

        {/* Recomendação geral */}
        <View style={styles.recomBox}>
          <Text style={styles.recomLabel}>Recomendação Geral</Text>
          <Text style={styles.recomText}>{plano.recomendacaoGeral}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Plano gerado por IA Maritaca Sabiá · XTRI — Preparação ENEM</Text>
          <Text style={styles.footerText}>Valide com seu professor · {hoje}</Text>
        </View>

      </Page>
    </Document>
  )
}
