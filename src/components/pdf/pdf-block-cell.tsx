import { View, Text } from '@react-pdf/renderer'
import type { BlocoCronograma, HorarioOficial } from '../../types/domain'
import { TIPO_BLOCO_LABELS } from '../../types/domain'
import { getBlockColorWithAutoDetect } from '../../constants/colors'
import { styles } from './pdf-styles'

type PdfBlockCellProps = {
  official?: HorarioOficial
  block?: BlocoCronograma
}

export function PdfBlockCell({ official, block }: PdfBlockCellProps) {
  // Official class takes priority
  if (official) {
    return (
      <View style={styles.officialBlock}>
        <Text style={styles.officialTitle}>{official.disciplina}</Text>
        {official.professor && (
          <Text style={styles.officialProfessor}>{official.professor}</Text>
        )}
      </View>
    )
  }

  // Custom block
  if (block) {
    const backgroundColor = getBlockColorWithAutoDetect(
      block.tipo,
      block.titulo,
      null,
      block.cor
    )

    return (
      <View style={[styles.blockCard, { backgroundColor }]}>
        <Text style={styles.blockTitle}>{block.titulo}</Text>
        <Text style={styles.blockSubtitle}>{TIPO_BLOCO_LABELS[block.tipo]}</Text>
      </View>
    )
  }

  // Empty slot
  return <View style={styles.emptySlot} />
}
