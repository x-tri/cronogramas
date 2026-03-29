import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { PlanoEstudo } from '../../services/maritaca'

const PRIO_COLORS: Record<string, string> = {
  ALTA: '#dc2626',
  MEDIA: '#d97706',
  BAIXA: '#6b7280',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
  },
  // ── Header ──
  headerCenter: { alignItems: 'center', marginBottom: 4 },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', letterSpacing: -0.5 },
  headerSub: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#e3e2e0', marginVertical: 14 },
  // ── Estratégia ──
  estrategiaBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#0071e3',
    paddingLeft: 10,
    marginBottom: 14,
  },
  estrategiaLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginBottom: 4 },
  estrategiaText: { fontSize: 8.5, color: '#374151', lineHeight: 1.6 },
  // ── Diagnóstico ──
  diagBox: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 5,
    padding: 12,
    marginBottom: 16,
  },
  diagTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  diagRow: { flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' },
  diagLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1d1d1f', marginRight: 4 },
  diagItems: { fontSize: 8.5, color: '#dc2626', flex: 1, lineHeight: 1.5 },
  diagItemsGreen: { fontSize: 8.5, color: '#059669', flex: 1, lineHeight: 1.5 },
  diagItemsMeta: { fontSize: 8.5, color: '#1d4ed8', flex: 1, lineHeight: 1.5 },
  // ── Tabela ──
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
  // ── Linha da tabela ──
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
  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e3e2e0',
    paddingTop: 7,
  },
  footerText: { fontSize: 7.5, color: '#9ca3af' },
  footerSub: { fontSize: 7, color: '#c1c0bb', marginTop: 2 },
  // ── Pausa (itálico) ──
  pausaTitulo: { fontSize: 9, fontFamily: 'Helvetica-Oblique', color: '#6b7280', marginBottom: 3 },
  pausaDescricao: { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 2 },
  pausaDica: { fontSize: 7.5, color: '#10b981', fontStyle: 'italic' },
})

type Props = {
  plano: PlanoEstudo
  nomeAluno: string | null
  simuladoTitle: string
}

export function PlanoEstudoPDF({ plano, nomeAluno, simuladoTitle }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Document title={`Plano de Estudos — ${nomeAluno ?? 'Aluno'}`}>
      <Page size="A4" style={s.page}>

        {/* Header centralizado */}
        <View style={s.headerCenter}>
          <Text style={s.h1}>Plano de Estudos Personalizado</Text>
          <Text style={s.headerSub}>
            Gerado por IA - XTRI{nomeAluno ? ` | ${nomeAluno}` : ''} | {hoje}
          </Text>
        </View>

        <View style={s.divider} />

        {/* Estratégia */}
        <View style={s.estrategiaBox}>
          <Text style={s.estrategiaLabel}>Estrategia:</Text>
          <Text style={s.estrategiaText}>{plano.estrategia}</Text>
        </View>

        {/* Diagnóstico */}
        <View style={s.diagBox}>
          <Text style={s.diagTitle}>Diagnostico do Aluno</Text>
          <View style={s.diagRow}>
            <Text style={s.diagLabel}>Pontos fracos:</Text>
            <Text style={s.diagItems}>{plano.diagnostico.pontosFracos.join(', ')}</Text>
          </View>
          <View style={s.diagRow}>
            <Text style={s.diagLabel}>Pontos fortes:</Text>
            <Text style={s.diagItemsGreen}>{plano.diagnostico.pontosFortes.join(', ')}</Text>
          </View>
          <View style={s.diagRow}>
            <Text style={s.diagLabel}>Meta proximo simulado:</Text>
            <Text style={s.diagItemsMeta}>{plano.diagnostico.metaProximoSimulado}</Text>
          </View>
        </View>

        {/* Tabela de atividades */}
        <View style={s.tableHeader}>
          <Text style={s.thHorario}>Horario</Text>
          <Text style={s.thAtividade}>Atividade</Text>
          <Text style={s.thPrio}>Prioridade</Text>
        </View>

        {plano.atividades.map((a, i) => {
          const isPausa = a.area === 'pausa'
          const prioColor = PRIO_COLORS[a.prioridade] ?? '#6b7280'

          return (
            <View key={i} style={s.tableRow} wrap={false}>
              {/* Checkbox */}
              <View style={s.tdCheckbox} />

              {/* Horário */}
              <Text style={s.tdHorario}>{a.horario}</Text>

              {/* Corpo */}
              <View style={s.tdBody}>
                <Text style={isPausa ? s.pausaTitulo : [s.tdTitulo, { color: isPausa ? '#6b7280' : '#1d1d1f' }]}>
                  {a.titulo}
                </Text>
                <Text style={isPausa ? s.pausaDescricao : s.tdDescricao}>
                  {a.descricao}
                </Text>
                {a.dica ? (
                  <Text style={isPausa ? s.pausaDica : s.tdDica}>
                    Dica: {a.dica}
                  </Text>
                ) : null}
              </View>

              {/* Prioridade */}
              <View style={s.tdPrio}>
                {!isPausa && (
                  <Text style={[s.tdPrioText, { color: prioColor }]}>
                    {a.prioridade}
                  </Text>
                )}
              </View>
            </View>
          )
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Gerado automaticamente pela IA do XTRI - Plataforma de Estudos para o ENEM</Text>
          <Text style={s.footerSub}>Plano personalizado com base nos seus resultados de simulado. · {simuladoTitle}</Text>
        </View>

      </Page>
    </Document>
  )
}
