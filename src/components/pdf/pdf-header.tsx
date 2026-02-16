import { View, Text } from '@react-pdf/renderer'
import type { Aluno } from '../../types/domain'
import { styles } from './pdf-styles'

type PdfHeaderProps = {
  student: Aluno
  weekStart: Date
  weekEnd: Date
  examTitle?: string | null
  triScores?: {
    tri_lc: number | null
    tri_ch: number | null
    tri_cn: number | null
    tri_mt: number | null
  } | null
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function PdfHeader({ student, weekStart, weekEnd, examTitle, triScores }: PdfHeaderProps) {
  const weekStr = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
  const hasTriScores = triScores && (triScores.tri_lc || triScores.tri_ch || triScores.tri_cn || triScores.tri_mt)

  return (
    <View style={styles.header}>
      {/* Título */}
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>CRONOGRAMA DE ESTUDOS</Text>
          <Text style={styles.subtitle}>XTRI - Sistema de Cronogramas Personalizados</Text>
        </View>
      </View>
      
      {/* Tudo em uma linha */}
      <View style={styles.infoRow}>
        {/* Aluno e Turma */}
        <View style={styles.infoGroup}>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Aluno: </Text>
            {student.nome}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Turma: </Text>
            {student.turma}
          </Text>
        </View>

        {/* Matrícula e Semana */}
        <View style={styles.infoGroup}>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Matrícula: </Text>
            {student.matricula}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Semana: </Text>
            {weekStr}
          </Text>
        </View>

        {/* Simulado (se houver) */}
        {examTitle && (
          <View style={styles.infoGroup}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Simulado: </Text>
              <Text style={{ color: '#3B82F6' }}>{examTitle}</Text>
            </Text>
          </View>
        )}

        {/* Notas TRI (se houver) */}
        {hasTriScores && (
          <View style={styles.triScoresRow}>
            {triScores?.tri_lc && (
              <View style={[styles.triBadge, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.triBadgeLabel}>LC</Text>
                <Text style={styles.triBadgeValue}>{triScores.tri_lc.toFixed(0)}</Text>
              </View>
            )}
            {triScores?.tri_ch && (
              <View style={[styles.triBadge, { backgroundColor: '#F97316' }]}>
                <Text style={styles.triBadgeLabel}>CH</Text>
                <Text style={styles.triBadgeValue}>{triScores.tri_ch.toFixed(0)}</Text>
              </View>
            )}
            {triScores?.tri_cn && (
              <View style={[styles.triBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.triBadgeLabel}>CN</Text>
                <Text style={styles.triBadgeValue}>{triScores.tri_cn.toFixed(0)}</Text>
              </View>
            )}
            {triScores?.tri_mt && (
              <View style={[styles.triBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.triBadgeLabel}>MT</Text>
                <Text style={styles.triBadgeValue}>{triScores.tri_mt.toFixed(0)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
