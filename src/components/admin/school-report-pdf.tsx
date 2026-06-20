import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { formatDateShortBR } from '../../lib/format-date'
import { PDF_TYPE_LABELS } from './pdf-types'
import type { MentorEngagementRow } from './mentor-engagement'
import type { Atendimento } from './school-detail'

type SchoolReportSchool = {
  readonly name: string
  readonly alunos_base: number
  readonly alunos_com_simulado: number
  readonly alunos_atendidos: number
  readonly cronogramas_gerados: number
  readonly blocos_criados: number
}

export type SchoolReportPdfProps = {
  readonly school: SchoolReportSchool
  readonly atendimentos: readonly Atendimento[]
  readonly mentores: readonly MentorEngagementRow[]
  readonly pdfsPorTipo: Readonly<Record<string, number>>
  readonly generatedAt: Date
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    color: '#1d1d1f',
    fontFamily: 'Helvetica',
  },
  eyebrow: {
    color: '#64748b',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 9,
    marginBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  metricCard: {
    flexGrow: 1,
    border: '1 solid #e5e7eb',
    borderRadius: 8,
    padding: 8,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 3,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#334155',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1 solid #f1f5f9',
    paddingVertical: 5,
  },
  rowHeader: {
    backgroundColor: '#f8fafc',
    borderTop: '1 solid #e5e7eb',
    borderBottom: '1 solid #e5e7eb',
  },
  colAluno: { flexGrow: 1, flexBasis: 180 },
  colTurma: { width: 70 },
  colData: { width: 95, textAlign: 'right' },
  colMentor: { flexGrow: 1, flexBasis: 160 },
  colSmall: { width: 70, textAlign: 'right' },
  muted: { color: '#64748b' },
  mentorLine: { color: '#334155', marginTop: 2 },
  empty: {
    color: '#94a3b8',
    fontSize: 9,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    border: '1 solid #dbeafe',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    color: '#94a3b8',
    fontSize: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function pct(value: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function formatDateTimeBR(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SchoolReportPDF({
  school,
  atendimentos,
  mentores,
  pdfsPorTipo,
  generatedAt,
}: SchoolReportPdfProps) {
  return (
    <Document title={`Relatório executivo - ${school.name}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Visão Executiva · Relatório da escola</Text>
        <Text style={styles.title}>{school.name}</Text>
        <Text style={styles.subtitle}>Gerado em {formatDateTimeBR(generatedAt)}</Text>

        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{school.alunos_base}</Text>
            <Text style={styles.metricLabel}>alunos na base</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{school.alunos_com_simulado}</Text>
            <Text style={styles.metricLabel}>fizeram simulado</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {school.alunos_atendidos} ({pct(school.alunos_atendidos, school.alunos_base)})
            </Text>
            <Text style={styles.metricLabel}>atendidos</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{school.cronogramas_gerados}</Text>
            <Text style={styles.metricLabel}>cronogramas gerados</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{school.blocos_criados}</Text>
            <Text style={styles.metricLabel}>blocos criados</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos gerados</Text>
          {Object.keys(pdfsPorTipo).length === 0 ? (
            <Text style={styles.empty}>Nenhum PDF registrado para esta escola.</Text>
          ) : (
            <View style={styles.chipRow}>
              {Object.entries(pdfsPorTipo).map(([tipo, total]) => (
                <Text key={tipo} style={styles.chip}>
                  {PDF_TYPE_LABELS[tipo] ?? tipo}: {total}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mentores</Text>
          {mentores.length === 0 ? (
            <Text style={styles.empty}>Nenhum mentor vinculado.</Text>
          ) : (
            <>
              <View style={[styles.row, styles.rowHeader]}>
                <Text style={styles.colMentor}>Mentor</Text>
                <Text style={styles.colSmall}>PDFs 30d</Text>
                <Text style={styles.colSmall}>Alunos 30d</Text>
                <Text style={styles.colSmall}>Planos 30d</Text>
              </View>
              {mentores.map((mentor) => (
                <View key={mentor.email} style={styles.row} wrap={false}>
                  <Text style={styles.colMentor}>
                    {mentor.name || mentor.email}
                    {'\n'}
                    <Text style={styles.muted}>{mentor.email}</Text>
                  </Text>
                  <Text style={styles.colSmall}>{mentor.pdfs_30d}</Text>
                  <Text style={styles.colSmall}>{mentor.alunos_30d}</Text>
                  <Text style={styles.colSmall}>{mentor.planos_30d}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atendimentos ({atendimentos.length})</Text>
          {atendimentos.length === 0 ? (
            <Text style={styles.empty}>Nenhum aluno com cronograma registrado.</Text>
          ) : (
            <>
              <View style={[styles.row, styles.rowHeader]}>
                <Text style={styles.colAluno}>Aluno</Text>
                <Text style={styles.colTurma}>Turma</Text>
                <Text style={styles.colData}>Último cronograma</Text>
              </View>
              {atendimentos.map((aluno) => (
                <View key={aluno.matricula} style={styles.row} wrap={false}>
                  <Text style={styles.colAluno}>
                    {aluno.nome}
                    {'\n'}
                    <Text style={styles.muted}>{aluno.matricula}</Text>
                    {'\n'}
                    <Text style={styles.mentorLine}>
                      Mentor: {aluno.mentorNome ?? 'não registrado'}
                    </Text>
                  </Text>
                  <Text style={styles.colTurma}>{aluno.turma}</Text>
                  <Text style={styles.colData}>{formatDateShortBR(aluno.ultimoCronograma)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>XTRI Cronogramas</Text>
          <Text>Relatório interno · dados operacionais reais</Text>
        </View>
      </Page>
    </Document>
  )
}
