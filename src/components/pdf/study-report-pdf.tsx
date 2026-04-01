import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { StudyReport } from '../../services/study-report'

const PRIO_COLORS: Record<string, string> = {
  ALTA: '#dc2626',
  MEDIA: '#d97706',
  BAIXA: '#6b7280',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 42,
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
  },
  headerCenter: { alignItems: 'center', marginBottom: 4 },
  h1: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', letterSpacing: -0.4 },
  headerSub: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#e3e2e0', marginVertical: 12 },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  line: { fontSize: 8.5, color: '#374151', lineHeight: 1.5, marginBottom: 3 },
  lineLabel: { fontFamily: 'Helvetica-Bold', color: '#1d1d1f' },
  strategyBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#0071e3',
    paddingLeft: 10,
    marginBottom: 12,
  },
  strategyText: { fontSize: 8.5, color: '#374151', lineHeight: 1.6 },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  weightCard: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    padding: 8,
    marginRight: '3.5%',
    marginBottom: 8,
  },
  weightCardThird: { marginRight: 0 },
  weightLabel: { fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  weightValue: { fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica-Bold', marginTop: 5 },
  weightHelper: { fontSize: 7.5, color: '#64748b', marginTop: 2 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d0cb',
    paddingBottom: 5,
    marginBottom: 4,
  },
  thHorario: { width: 70, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold' },
  thAtividade: { flex: 1, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', marginLeft: 8 },
  thPrio: { width: 56, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1ef',
    paddingVertical: 8,
  },
  tdCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#d1d0cb',
    borderRadius: 2,
    marginTop: 1,
    marginRight: 6,
    flexShrink: 0,
  },
  tdHorario: { width: 60, fontSize: 8, color: '#6b7280', flexShrink: 0, marginTop: 1 },
  tdBody: { flex: 1, marginLeft: 4 },
  tdTitulo: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginBottom: 3 },
  tdDescricao: { fontSize: 8, color: '#4b5563', lineHeight: 1.5, marginBottom: 3 },
  tdDica: { fontSize: 7.5, color: '#0071e3', fontStyle: 'italic', lineHeight: 1.4 },
  tdPrio: { width: 52, alignItems: 'flex-end', flexShrink: 0 },
  tdPrioText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 42,
    right: 42,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e3e2e0',
    paddingTop: 7,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
  footerSub: { fontSize: 7, color: '#c1c0bb', marginTop: 2 },
})

type Props = {
  report: StudyReport
  nomeAluno: string | null
  simuladoTitle: string
}

function buildCutoffHelper(report: StudyReport): string {
  if (!report.pesos.notaCorteReferencia) {
    return 'Sem corte disponível'
  }

  const modeLabel = report.pesos.notaCorteTipo === 'ampla_concorrencia' ? 'Ampla concorrência' : 'Modalidade de referência'
  const sourceLabel = report.pesos.notaCorteOrigem === 'aprovados_final' ? 'Final Cut Score' : 'Nota de corte'
  const parts = [`${sourceLabel} · ${modeLabel} · Ano ${report.pesos.notaCorteAno ?? '-'}`]

  if (
    report.pesos.maiorNotaConvocadoAmostra != null
    && report.pesos.menorNotaConvocadoAmostra != null
  ) {
    parts.push(`Maior nota: ${report.pesos.maiorNotaConvocadoAmostra.toFixed(2)}`)
    parts.push(`Menor nota: ${report.pesos.menorNotaConvocadoAmostra.toFixed(2)}`)
  }

  return parts.join(' | ')
}

export function StudyReportPDF({ report, nomeAluno, simuladoTitle }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Document title={`Relatório de Estudos — ${nomeAluno ?? 'Aluno'}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerCenter}>
          <Text style={s.h1}>Relatório de Estudos por Objetivo</Text>
          <Text style={s.headerSub}>XTRI{nomeAluno ? ` | ${nomeAluno}` : ''} | {hoje}</Text>
        </View>

        <View style={s.divider} />

        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Objetivo selecionado</Text>
          <Text style={s.line}>
            <Text style={s.lineLabel}>Curso: </Text>{report.objetivo.curso}
          </Text>
          <Text style={s.line}>
            <Text style={s.lineLabel}>Universidade: </Text>{report.objetivo.universidade}
          </Text>
          <Text style={s.line}>
            <Text style={s.lineLabel}>Local: </Text>{report.objetivo.cidade}/{report.objetivo.estado}
          </Text>
        </View>

        <View style={s.weightsGrid}>
          {[
            { label: 'Linguagens', value: report.pesos.linguagens },
            { label: 'Humanas', value: report.pesos.humanas },
            { label: 'Natureza', value: report.pesos.natureza },
            { label: 'Matemática', value: report.pesos.matematica },
            { label: 'Redação', value: report.pesos.redacao },
            {
              label: 'Corte Final',
              value: report.pesos.notaCorteReferencia,
              helper: buildCutoffHelper(report),
            },
          ].map((item, index) => (
            <View key={item.label} style={index % 3 === 2 ? [s.weightCard, s.weightCardThird] : [s.weightCard]}>
              <Text style={s.weightLabel}>{item.label}</Text>
              <Text style={s.weightValue}>{item.value != null ? item.value.toFixed(2) : '-'}</Text>
              {'helper' in item && item.helper ? <Text style={s.weightHelper}>{item.helper}</Text> : null}
            </View>
          ))}
        </View>

        <View style={s.strategyBox}>
          <Text style={s.sectionTitle}>Estratégia</Text>
          <Text style={s.strategyText}>{report.estrategia}</Text>
        </View>

        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Melhorias nas 4 áreas</Text>
          {report.melhoriasAreas.map((item) => (
            <Text key={item.area} style={s.line}>
              <Text style={s.lineLabel}>{item.label} ({item.prioridade}): </Text>
              TRI {item.triScore != null ? Math.round(item.triScore) : '-'} | Peso SISU {item.pesoSisu.toFixed(2)} | Foco {item.topicoFoco}. {item.acao}
            </Text>
          ))}
        </View>

        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Diagnóstico do aluno</Text>
          <Text style={s.line}><Text style={s.lineLabel}>Pontos fracos: </Text>{report.diagnostico.pontosFracos.join(', ')}</Text>
          <Text style={s.line}><Text style={s.lineLabel}>Pontos fortes: </Text>{report.diagnostico.pontosFortes.join(', ')}</Text>
          <Text style={s.line}><Text style={s.lineLabel}>Meta do próximo simulado: </Text>{report.diagnostico.metaProximoSimulado}</Text>
        </View>

        <View style={s.tableHeader}>
          <Text style={s.thHorario}>Horário</Text>
          <Text style={s.thAtividade}>Atividade</Text>
          <Text style={s.thPrio}>Prioridade</Text>
        </View>

        {report.atividades.map((atividade, index) => {
          const isPausa = atividade.area === 'pausa'
          const prioColor = PRIO_COLORS[atividade.prioridade] ?? '#6b7280'

          return (
            <View key={index} style={s.tableRow} wrap={false}>
              <View style={s.tdCheckbox} />
              <Text style={s.tdHorario}>{atividade.horario}</Text>
              <View style={s.tdBody}>
                <Text style={s.tdTitulo}>{atividade.titulo}</Text>
                <Text style={s.tdDescricao}>{atividade.descricao}</Text>
                {atividade.dica ? <Text style={s.tdDica}>Dica: {atividade.dica}</Text> : null}
              </View>
              <View style={s.tdPrio}>
                {!isPausa ? <Text style={[s.tdPrioText, { color: prioColor }]}>{atividade.prioridade}</Text> : null}
              </View>
            </View>
          )
        })}

        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Metodologia</Text>
          <Text style={s.line}>{report.referencias.metodologia}</Text>
          <Text style={s.line}>{report.referencias.baseHistorica}</Text>
          {report.referencias.habilidadesOficiais.slice(0, 4).map((habilidade) => (
            <Text key={habilidade} style={s.line}>• {habilidade}</Text>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Relatório determinístico da XTRI com base em simulado, SISU e ENEM</Text>
          <Text style={s.footerSub}>{simuladoTitle}</Text>
        </View>
      </Page>
    </Document>
  )
}
