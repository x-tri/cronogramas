import { View, Text } from '@react-pdf/renderer'
import type { Aluno } from '../../types/domain'
import { styles } from './pdf-styles'

type PdfHeaderProps = {
  student: Aluno
  weekStart: Date
  weekEnd: Date
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function PdfHeader({ student, weekStart, weekEnd }: PdfHeaderProps) {
  const weekStr = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>CRONOGRAMA DE ESTUDOS</Text>
          <Text style={styles.subtitle}>XTRI - Sistema de Cronogramas Personalizados</Text>
        </View>
      </View>
      <View style={styles.studentInfo}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Aluno:</Text>
          <Text>{student.nome}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Matricula:</Text>
          <Text>{student.matricula}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Turma:</Text>
          <Text>{student.turma}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Semana:</Text>
          <Text>{weekStr}</Text>
        </View>
      </View>
    </View>
  )
}
