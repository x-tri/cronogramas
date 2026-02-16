import { StyleSheet } from '@react-pdf/renderer'

// A4 Landscape: 842 x 595 pontos
// Com padding 20: 802 x 555 área útil
const COLUMN_WIDTH = 120
const COLUMN_WIDTH_WEEKEND = 91
const SLOT_HEIGHT = 24
const HEADER_HEIGHT = 18

export const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 8,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '2 solid #3B82F6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 9,
    color: '#6b7280',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1 solid #e5e7eb',
  },
  infoGroup: {
    flexDirection: 'column',
    gap: 2,
  },
  infoText: {
    fontSize: 8,
    color: '#374151',
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  triScoresRow: {
    flexDirection: 'row',
    gap: 6,
  },
  triBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '2 6',
    borderRadius: 10,
    gap: 3,
  },
  triBadgeLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  triBadgeValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    borderTop: '1 solid #e5e7eb',
    borderLeft: '1 solid #e5e7eb',
  },
  column: {
    width: COLUMN_WIDTH,
    borderRight: '1 solid #e5e7eb',
  },
  columnWeekend: {
    width: COLUMN_WIDTH_WEEKEND,
    borderRight: '1 solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  columnHeader: {
    backgroundColor: '#3B82F6',
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1 solid #e5e7eb',
  },
  columnHeaderText: {
    fontWeight: 'bold',
    fontSize: 8,
    color: '#ffffff',
  },
  columnHeaderWeekend: {
    backgroundColor: '#10B981',
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1 solid #e5e7eb',
  },
  turnoSection: {
    borderBottom: '1 solid #e5e7eb',
  },
  turnoLabel: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#6b7280',
    height: 10,
    backgroundColor: '#f3f4f6',
    textAlign: 'center',
    paddingTop: 2,
    borderBottom: '0.5 solid #e5e7eb',
  },
  slot: {
    height: SLOT_HEIGHT,
    padding: 1,
    borderBottom: '0.5 solid #e5e7eb',
  },
  slotTime: {
    fontSize: 4,
    color: '#9ca3af',
  },
  blockCard: {
    padding: 1,
    borderRadius: 2,
    marginTop: 1,
  },
  blockTitle: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  blockSubtitle: {
    fontSize: 4,
    color: '#ffffff',
  },
  officialBlock: {
    padding: 1,
    borderRadius: 2,
    backgroundColor: '#6B7280',
    marginTop: 1,
  },
  officialTitle: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  officialProfessor: {
    fontSize: 4,
    color: '#ffffff',
  },
  emptySlot: {
    height: SLOT_HEIGHT - 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1 solid #e5e7eb',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 5,
    color: '#4b5563',
  },
  footer: {
    marginTop: 6,
    paddingTop: 4,
    borderTop: '1 solid #e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 5,
    color: '#9ca3af',
  },
})
