import { useEffect, useState } from "react";
import { StudentSearch } from "./components/student/student-search";
import { AlunoAvulsoForm } from "./components/student/aluno-avulso-form";
import { StudentCard } from "./components/student/student-card";
import { SimuladoAnalyzer } from "./components/simulado/simulado-analyzer";
import { KanbanBoard } from "./components/kanban/kanban-board";
import { BlockEditorModal } from "./components/blocks/block-editor-modal";
import { HistoryDropdown } from "./components/cronograma/history-dropdown";
import { WeekSelector } from "./components/week-selector";
import { ShareDropdown } from "./components/export/share-dropdown";
import { ResetButton } from "./components/cronograma/reset-button";
import { useCronogramaStore } from "./stores/cronograma-store";
import type { BlocoCronograma, DiaSemana, Turno } from "./types/domain";
import { ESCOLA_LABELS } from "./types/domain";
import { TURNOS_CONFIG } from "./constants/time-slots";
import { getCurrentUser, type User } from "./lib/auth";
import { LoginForm } from "./components/login-form";

type SlotSelection = {
  dia: DiaSemana;
  turno: Turno;
  slotIndex: number;
};

function AppContent() {
  const currentStudent = useCronogramaStore((state) => state.currentStudent);
  const currentSchoolName =
    currentStudent?.escolaNome?.trim() ||
    (currentStudent ? ESCOLA_LABELS[currentStudent.escola] : "Colégio");
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlocoCronograma | null>(
    null,
  );

  const handleSlotClick = (dia: DiaSemana, turno: Turno, slotIndex: number) => {
    setSelectedSlot({ dia, turno, slotIndex });
    setEditingBlock(null);
  };

  const handleBlockEdit = (block: BlocoCronograma) => {
    const turnoConfig = TURNOS_CONFIG[block.turno];
    const slotIndex = turnoConfig.slots.findIndex(
      (slot) => slot.inicio === block.horarioInicio,
    );
    if (slotIndex !== -1) {
      setSelectedSlot({
        dia: block.diaSemana,
        turno: block.turno,
        slotIndex,
      });
      setEditingBlock(block);
    }
  };

  const handleCloseModal = () => {
    setSelectedSlot(null);
    setEditingBlock(null);
  };

  const [user, setUser] = useState<User | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  async function fetchUser() {
    try {
      const user = await getCurrentUser();
      setUser(user);
      setIsChecking(false);
    } catch {
      console.error("Erro ao obter usuário");
      setUser(null);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  async function handleLoginSuccess() {
    try {
      const user = await getCurrentUser();
      setUser(user);
    } catch {
      console.error("Erro ao obter usuário após login");
    }
  }

  function handleLogout() {
    setUser(null);
  }

  if (isChecking) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user) return <LoginForm onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="min-h-screen bg-[#fafafa] apple-theme">
      {/* Header Apple-like com glassmorphism */}
      <header className="sticky top-0 z-50 apple-header">
        <div className="notion-page">
          <div className="flex items-center justify-between h-14">
            {/* Logo simples */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-[#37352f] rounded">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-medium text-[#37352f]">
                  XTRI Cronogramas
                </h1>
                <span className="text-[#9ca3af]">/</span>
                <span className="text-sm text-[#6b6b67]">
                  {currentSchoolName}
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-500 ml-auto">{user.name}</span>
              <button
                onClick={handleLogout}
                className="ml-auto flex h-10  items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground line p-2 py-0"
              >
                Sair
              </button>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-4">
              {currentStudent && (
                <>
                  <div className="h-4 w-px bg-[#e3e2e0]" />
                  <ResetButton />
                  <div className="h-4 w-px bg-[#e3e2e0]" />
                  <WeekSelector />
                  <div className="h-4 w-px bg-[#e3e2e0]" />
                  <ShareDropdown />
                  <HistoryDropdown />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="py-10">
        <div className="space-y-10">
          {/* Título da página - estilo Apple */}
          <div className="max-w-4xl mx-auto px-6 pb-6">
            <h1 className="text-apple-headline text-[#1d1d1f]">
              Cronograma de Estudos
            </h1>
            <p className="mt-3 text-apple-body text-[#86868b]">
              Gerencie seu planejamento semanal de estudos integrado aos
              horários de aula.
            </p>
          </div>

          {/* Busca - estilo Apple Card */}
          <section className="max-w-4xl mx-auto px-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#0071e3]/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-[#0071e3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h2 className="text-apple-title text-[#1d1d1f]">
                Consultar Aluno
              </h2>
            </div>
            <div className="apple-card-elevated p-6">
              <StudentSearch />
              <div className="mt-6 pt-6 border-t border-[rgba(0,0,0,0.08)]">
                <AlunoAvulsoForm />
              </div>
            </div>
          </section>

          {/* Dados do Aluno e Análise - limitado em largura */}
          {currentStudent && (
            <>
              <div className="max-w-4xl mx-auto px-6">
                <StudentCard student={currentStudent} />
              </div>

              {/* Divider com título - estilo Apple */}
              <div className="max-w-4xl mx-auto px-6">
                <div className="flex items-center gap-4 py-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d1d1d6] to-transparent" />
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-apple-sm">
                    <svg
                      className="w-4 h-4 text-[#0071e3]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-[#1d1d1f]">
                      Análise de Desempenho
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d1d1d6] to-transparent" />
                </div>
              </div>

              <section className="max-w-4xl mx-auto px-6">
                <div className="apple-card p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0071e3] to-[#00c7be] flex items-center justify-center shadow-lg">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-apple-body text-[#1d1d1f] font-medium">
                          Análise de Simulado
                        </p>
                        <p className="text-sm text-[#86868b]">
                          Visualize erros e notas TRI para criar revisões
                          personalizadas.
                        </p>
                      </div>
                    </div>
                    <SimuladoAnalyzer matricula={currentStudent.matricula} />
                  </div>
                </div>
              </section>

              {/* Kanban - estilo Apple */}
              <section className="px-6">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#af52de] to-[#0071e3] flex items-center justify-center shadow-lg">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-apple-title text-[#1d1d1f]">
                          Cronograma Semanal
                        </h2>
                        <p className="text-sm text-[#86868b]">
                          Clique em um horário para adicionar blocos de estudo
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="apple-card-elevated p-4">
                    <KanbanBoard
                      onSlotClick={handleSlotClick}
                      onBlockEdit={handleBlockEdit}
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer estilo Apple */}
      <footer className="mt-20 border-t border-[rgba(0,0,0,0.08)]">
        <div className="notion-page py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0071e3] to-[#af52de] flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-[#1d1d1f]">
                  XTRI Cronogramas
                </span>
                <span className="text-sm text-[#86868b] ml-2">
                  Colégio Marista de Natal
                </span>
              </div>
            </div>
            <span className="text-xs text-[#a1a1a6] font-medium">
              Versão 2.0
            </span>
          </div>
        </div>
      </footer>

      {/* Modais */}
      {selectedSlot && (
        <BlockEditorModal
          isOpen={true}
          onClose={handleCloseModal}
          dia={selectedSlot.dia}
          turno={selectedSlot.turno}
          slotIndex={selectedSlot.slotIndex}
          editingBlock={editingBlock ?? undefined}
        />
      )}
    </div>
  );
}

export { AppContent };
