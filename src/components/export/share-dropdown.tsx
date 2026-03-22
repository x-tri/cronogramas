import { useState } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getWeekBounds } from '../week-utils'
import type { SimuladoResult } from '../../types/supabase'

type PdfDeps = [
  typeof import('@react-pdf/renderer'),
  typeof import('../pdf/schedule-pdf-document'),
]

let pdfDepsPromise: Promise<PdfDeps> | null = null
let analyzerDepsPromise: Promise<typeof import('../../services/simulado-analyzer')> | null =
  null

function loadPdfDeps() {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([
      import('@react-pdf/renderer'),
      import('../pdf/schedule-pdf-document'),
    ])
  }

  return pdfDepsPromise
}

function loadAnalyzerDeps() {
  if (!analyzerDepsPromise) {
    analyzerDepsPromise = import('../../services/simulado-analyzer')
  }

  return analyzerDepsPromise
}

export function ShareDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [simuladoData, setSimuladoData] = useState<SimuladoResult | null>(null)

  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const blocks = useCronogramaStore((state) => state.blocks)
  const selectedWeek = useCronogramaStore((state) => state.selectedWeek)

  if (!currentStudent) return null

  const { start, end } = getWeekBounds(selectedWeek)

  const preloadShareAssets = () => {
    void loadPdfDeps()
    void loadAnalyzerDeps()
  }

  const ensureSimuladoData = async (): Promise<SimuladoResult | null> => {
    if (simuladoData) return simuladoData
    if (!currentStudent?.matricula) return null

    const { analyzeStudentSimulado } = await loadAnalyzerDeps()
    const data = await analyzeStudentSimulado(currentStudent.matricula)

    if (data) {
      setSimuladoData(data)
    }

    return data
  }

  const generatePdfBlob = async (simulado: SimuladoResult | null) => {
    const [{ pdf }, { SchedulePdfDocument }] = await loadPdfDeps()

    const triScores = simulado?.studentAnswer
      ? {
          tri_lc: simulado.studentAnswer.tri_lc,
          tri_ch: simulado.studentAnswer.tri_ch,
          tri_cn: simulado.studentAnswer.tri_cn,
          tri_mt: simulado.studentAnswer.tri_mt,
        }
      : null

    const doc = (
      <SchedulePdfDocument
        student={currentStudent}
        weekStart={start}
        weekEnd={end}
        officialSchedule={officialSchedule}
        blocks={blocks}
        examTitle={simulado?.exam?.title}
        triScores={triScores}
      />
    )

    return await pdf(doc).toBlob()
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const getFilename = () => {
    const dateStr = start.toISOString().split('T')[0]
    return `cronograma_${currentStudent.matricula}_${dateStr}.pdf`
  }

  const formatWeekStr = () => {
    return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`
  }

  const handleDownloadPdf = async () => {
    setIsGenerating(true)

    try {
      const simulado = await ensureSimuladoData()
      const blob = await generatePdfBlob(simulado)
      downloadBlob(blob, getFilename())
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
    } finally {
      setIsGenerating(false)
      setIsOpen(false)
    }
  }

  const handleWhatsApp = async () => {
    setIsGenerating(true)

    try {
      const simulado = await ensureSimuladoData()
      const blob = await generatePdfBlob(simulado)
      downloadBlob(blob, getFilename())

      // Incluir notas TRI na mensagem se disponíveis
      let triScoresText = ''
      if (simulado?.studentAnswer) {
        const { tri_lc, tri_ch, tri_cn, tri_mt } = simulado.studentAnswer
        if (tri_lc || tri_ch || tri_cn || tri_mt) {
          triScoresText = '\n\n*Notas TRI:*'
          if (tri_lc) triScoresText += `\nLC: ${tri_lc.toFixed(1)}`
          if (tri_ch) triScoresText += `\nCH: ${tri_ch.toFixed(1)}`
          if (tri_cn) triScoresText += `\nCN: ${tri_cn.toFixed(1)}`
          if (tri_mt) triScoresText += `\nMT: ${tri_mt.toFixed(1)}`
        }
      }

      const text = `*Cronograma de Estudos*${simulado?.exam?.title ? `\n*Simulado:* ${simulado.exam.title}` : ''}\n\nAluno: ${currentStudent.nome}\nMatrícula: ${currentStudent.matricula}\nTurma: ${currentStudent.turma}\nSemana: ${formatWeekStr()}${triScoresText}\n\n_PDF baixado - anexe na conversa_`

      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
    } finally {
      setIsGenerating(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={preloadShareAssets}
        onFocus={preloadShareAssets}
        disabled={isGenerating}
        className="px-2 py-1 text-xs font-medium text-[#64748b] hover:text-[#1d1d1f] hover:bg-[#f1f1ef] rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
      >
        {isGenerating ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
        Compartilhar
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={handleDownloadPdf}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baixar PDF
            </button>

            <button
              onClick={handleWhatsApp}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Enviar por WhatsApp
            </button>
          </div>
        </>
      )}
    </div>
  )
}
