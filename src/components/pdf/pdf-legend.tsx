import { View, Text } from '@react-pdf/renderer'
import { CORES_AREAS, CORES_TIPOS } from '../../constants/colors'
import { styles } from './pdf-styles'

const AREA_LABELS: Record<string, string> = {
  natureza: 'Natureza',
  matematica: 'Matematica',
  linguagens: 'Linguagens',
  humanas: 'Humanas',
}

const TIPO_LABELS: Record<string, string> = {
  aula_oficial: 'Aula',
  estudo: 'Estudo',
  revisao: 'Revisao',
  simulado: 'Simulado',
  descanso: 'Descanso',
  foco: 'Foco',
}

export function PdfLegend() {
  return (
    <View style={styles.legend}>
      {/* Areas ENEM */}
      {Object.entries(AREA_LABELS).map(([key, label]) => (
        <View key={key} style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: CORES_AREAS[key as keyof typeof CORES_AREAS] }]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
      {/* Block types */}
      {Object.entries(TIPO_LABELS).map(([key, label]) => (
        <View key={key} style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: CORES_TIPOS[key as keyof typeof CORES_TIPOS] }]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  )
}
