import { Document, Page, View, Text } from '@react-pdf/renderer'
import type { Aluno, BlocoCronograma, HorarioOficial, DiaSemana, Turno } from '../../types/domain'
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, TURNOS, TURNO_LABELS } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { styles } from './pdf-styles'
import { PdfHeader } from './pdf-header'
import { PdfBlockCell } from './pdf-block-cell'
import { PdfLegend } from './pdf-legend'

type SchedulePdfDocumentProps = {
  student: Aluno
  weekStart: Date
  weekEnd: Date
  officialSchedule: HorarioOficial[]
  blocks: BlocoCronograma[]
  examTitle?: string | null
  triScores?: {
    tri_lc: number | null
    tri_ch: number | null
    tri_cn: number | null
    tri_mt: number | null
  } | null
}

export function SchedulePdfDocument({
  student,
  weekStart,
  weekEnd,
  officialSchedule,
  blocks,
  examTitle,
  triScores,
}: SchedulePdfDocumentProps) {
  const getContent = (dia: DiaSemana, turno: Turno, slotInicio: string) => {
    const official = officialSchedule.find(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slotInicio
    )
    const block = blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slotInicio
    )
    return { official, block }
  }

  const isWeekend = (dia: DiaSemana) => dia === 'sabado' || dia === 'domingo'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <PdfHeader 
          student={student} 
          weekStart={weekStart} 
          weekEnd={weekEnd} 
          examTitle={examTitle}
          triScores={triScores}
        />

        <View style={styles.grid}>
          {DIAS_SEMANA.map((dia) => (
            <View key={dia} style={isWeekend(dia) ? styles.columnWeekend : styles.column}>
              <View style={isWeekend(dia) ? styles.columnHeaderWeekend : styles.columnHeader}>
                <Text style={styles.columnHeaderText}>{DIAS_SEMANA_LABELS[dia]}</Text>
              </View>

              {TURNOS.map((turno) => (
                <View key={turno} style={styles.turnoSection}>
                  <Text style={styles.turnoLabel}>{TURNO_LABELS[turno]}</Text>
                  {TURNOS_CONFIG[turno].slots.map((slot) => {
                    const { official, block } = getContent(dia, turno, slot.inicio)
                    return (
                      <View key={slot.inicio} style={styles.slot}>
                        <Text style={styles.slotTime}>
                          {slot.inicio}
                        </Text>
                        <PdfBlockCell official={official} block={block} />
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>

        <PdfLegend />

        <View style={styles.footer}>
          <Text>Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
          <Text>XTRI Cronogramas - Sistema de Estudo Personalizado</Text>
        </View>
      </Page>
    </Document>
  )
}
