import { useStudentProfile, useStudentReports } from "@/hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GraduationCap, ChevronDown, ChevronUp, XCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ReportData } from "@/components/analise/types";
import { SectionSisu } from "@/components/analise/SectionSisu";
import { SectionRoi } from "@/components/analise/SectionRoi";
import { SectionHabilidades } from "@/components/analise/SectionHabilidades";
import { SectionCenarios } from "@/components/analise/SectionCenarios";
import { SectionPerfilAprovados } from "@/components/analise/SectionPerfilAprovados";
import { SectionDesperdicios } from "@/components/analise/SectionDesperdicios";

export default function Analise() {
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: reports, isLoading } = useStudentReports(studentKey);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!reports?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-bounce-in">
        <div className="text-5xl mb-4 animate-float">🔍</div>
        <p className="text-lg font-black text-foreground">Análises em breve!</p>
        <p className="text-sm font-semibold text-muted-foreground mt-1">
          Seus relatórios de desempenho vão aparecer aqui 🎯
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      {reports.map((report, idx) => (
        <ErrorBoundary key={report.id} fallbackMessage="Não foi possível exibir este relatório.">
          <ReportCard report={report} index={idx} />
        </ErrorBoundary>
      ))}
    </div>
  );
}

function ReportCard({ report, index }: { report: any; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const data = (report.report_data || {}) as ReportData;
  const sisu = data.sisuAnalysis;
  const mapa = data.mapaHabilidades;
  const tri = data.parametrosTRI;
  const criticas = data.questoesRecomendadas?.habilidadesCriticas || [];
  const cenarios = data.cenarios;
  const perfil = data.perfilAprovados;

  return (
    <div
      className="rounded-2xl border-2 bg-card overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 0.1}s`, animationFillMode: "both" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start justify-between gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-black text-foreground truncate">
              {report.exam_title || "Análise"}
            </span>
          </div>
          {report.curso_nome && (
            <p className="text-xs font-bold text-accent truncate">
              🎓 {report.curso_nome} — {report.curso_universidade}
            </p>
          )}
          <p className="text-[10px] font-semibold text-muted-foreground mt-1">
            {new Date(report.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* 1. SISU */}
          {sisu && (
            <SectionSisu
              notaPonderadaAtual={sisu.notaPonderadaAtual}
              notaCorte={sisu.notaCorte}
              gap={sisu.gap}
            />
          )}

          {/* 2. ROI por Área */}
          {sisu?.roiPorArea && sisu.roiPorArea.length > 0 && (
            <SectionRoi roiAreas={sisu.roiPorArea} />
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3">
            {mapa && (
              <div className="rounded-xl border-2 p-3 text-center">
                <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                <p className="text-2xl font-black text-destructive">{mapa.totalQuestoesErradas}</p>
                <p className="text-[9px] font-bold text-muted-foreground">Questões Erradas</p>
              </div>
            )}
            {tri && (
              <div className="rounded-xl border-2 p-3 text-center">
                <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-amber-500">{tri.totalDesperdicios}</p>
                <p className="text-[9px] font-bold text-muted-foreground">Desperdícios</p>
              </div>
            )}
          </div>

          {/* 3. Habilidades Críticas + 4. Questões inline */}
          {criticas.length > 0 && (
            <SectionHabilidades habilidades={criticas} />
          )}

          {/* 5. Cenários */}
          {cenarios && (
            <SectionCenarios cenarios={cenarios} notaCorte={sisu?.notaCorte ?? 0} />
          )}

          {/* 6. Perfil dos Aprovados */}
          {perfil && (
            <SectionPerfilAprovados perfil={perfil} notaAluno={sisu?.notaPonderadaAtual ?? 0} />
          )}

          {/* 7. Desperdícios */}
          {tri && (
            <SectionDesperdicios
              totalDesperdicios={tri.totalDesperdicios}
              desperdicios={tri.desperdicios || []}
            />
          )}
        </div>
      )}
    </div>
  );
}
