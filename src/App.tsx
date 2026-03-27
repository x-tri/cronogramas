import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { StudentSearch } from "./components/student/student-search";
import { AlunoAvulsoForm } from "./components/student/aluno-avulso-form";
import { KanbanBoard } from "./components/kanban/kanban-board";
import { BlockEditorModal } from "./components/blocks/block-editor-modal";
import { HistoryPanel } from "./components/cronograma/history-panel";
import { WeekSelector } from "./components/week-selector";
import { ResetButton } from "./components/cronograma/reset-button";
import { AuditPanel } from "./components/audit/audit-panel";
import { useCronogramaStore } from "./stores/cronograma-store";
import type { BlocoCronograma, DiaSemana, Turno } from "./types/domain";
import { TURNOS_CONFIG } from "./constants/time-slots";
import { getWeekBounds } from "./components/week-utils";
import { getCurrentUser, logout, type User } from "./lib/auth";
import { LoginForm } from "./components/login-form";
import { TimelineView } from "./components/kanban/timeline-view";
import { supabase } from "./lib/supabase";

const ShareDropdown = lazy(() =>
  import("./components/export/share-dropdown").then((mod) => ({
    default: mod.ShareDropdown,
  })),
);

const SimuladoAnalyzer = lazy(() =>
  import("./components/simulado/simulado-analyzer").then((mod) => ({
    default: mod.SimuladoAnalyzer,
  })),
);

const AdminCoordinadores = lazy(() =>
  import("./components/admin/admin-coordenadores").then((mod) => ({
    default: mod.AdminCoordinadores,
  })),
);

type SlotSelection = {
  dia: DiaSemana;
  turno: Turno;
  slotIndex: number;
};

function AppContent() {
  const currentStudent = useCronogramaStore((state) => state.currentStudent);
  const selectedWeek = useCronogramaStore((state) => state.selectedWeek);

  const dayDates = useMemo(() => {
    const { start } = getWeekBounds(selectedWeek);
    return {
      segunda: new Date(start),
      terca: new Date(new Date(start).setDate(start.getDate() + 1)),
      quarta: new Date(new Date(start).setDate(start.getDate() + 2)),
      quinta: new Date(new Date(start).setDate(start.getDate() + 3)),
      sexta: new Date(new Date(start).setDate(start.getDate() + 4)),
      sabado: new Date(new Date(start).setDate(start.getDate() + 5)),
      domingo: new Date(new Date(start).setDate(start.getDate() + 6)),
    } as Record<DiaSemana, Date>;
  }, [selectedWeek]);

  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlocoCronograma | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"kanban" | "timeline">("timeline");
  const [showSearch, setShowSearch] = useState(false);

  const handleSlotClick = (
    dia: DiaSemana,
    turno: Turno,
    slotIndex: number,
  ) => {
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!isMounted) return;
        setUser(currentUser);
        if (currentUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
          if (isMounted) setUserRole(profile?.role ?? null);
        }
      } catch {
        if (!isMounted) return;
        setUser(null);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLoginSuccess() {
    try {
      const user = await getCurrentUser();
      setUser(user);
    } catch {
      console.error("Erro ao obter usuario apos login");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
      </main>
    );
  }

  if (!user) return <LoginForm onLoginSuccess={handleLoginSuccess} />;

  if (showAdmin && userRole === "super_admin") {
    return (
      <Suspense
        fallback={
          <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
          </main>
        }
      >
        <AdminCoordinadores onBack={() => setShowAdmin(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* ============================================================
          HEADER — Barra superior compacta e organizada
          ============================================================ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#e5e7eb]">
        <div className="max-w-[1440px] mx-auto px-4 h-12 flex items-center gap-3">
          {/* Logo XTRI */}
          <img src="/logo-xtri.png" alt="XTRI" className="h-7 w-7 flex-shrink-0" />

          {/* Buscar aluno (sempre visível) */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#64748b] hover:text-[#1d1d1f] hover:bg-[#f1f1ef] rounded-lg transition-colors"
            title={currentStudent ? "Trocar aluno" : "Buscar aluno"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {currentStudent ? "Trocar aluno" : "Buscar aluno"}
          </button>

          {/* Center: Week selector */}
          {currentStudent && (
            <div className="flex-1 flex items-center justify-center">
              <WeekSelector />
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            {currentStudent && (
              <>
                <Suspense fallback={null}>
                  <SimuladoAnalyzer matricula={currentStudent.matricula} />
                </Suspense>
                <ResetButton />
                <div className="w-px h-5 bg-[#e5e7eb]" />
                <Suspense fallback={null}>
                  <ShareDropdown />
                </Suspense>
                <AuditPanel />
              </>
            )}
            <div className="w-px h-5 bg-[#e5e7eb]" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8] hidden sm:inline">{user.name}</span>
              {userRole === "super_admin" && (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-md transition-colors"
                >
                  Admin
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-2 py-1 text-xs font-medium text-[#64748b] hover:text-[#1d1d1f] hover:bg-[#f1f1ef] rounded-md transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          SEARCH OVERLAY — aparece como modal quando necessario
          ============================================================ */}
      {(showSearch || !currentStudent) && (
        <div
          className={`${currentStudent ? "fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-start justify-center pt-20" : ""}`}
          onClick={currentStudent ? () => setShowSearch(false) : undefined}
        >
          <div
            className={`${currentStudent ? "bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-apple-scale-in" : "max-w-lg mx-auto mt-20"}`}
            onClick={currentStudent ? (e) => e.stopPropagation() : undefined}
          >
            <div className="p-6">
              {currentStudent && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#1d1d1f]">Buscar Aluno</h2>
                  <button
                    onClick={() => setShowSearch(false)}
                    className="p-1.5 rounded-lg hover:bg-[#f1f1ef] text-[#94a3b8] hover:text-[#1d1d1f] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {!currentStudent && (
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-[#1d1d1f] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-[#1d1d1f]">Cronograma de Estudos</h1>
                  <p className="text-sm text-[#86868b] mt-1">Busque um aluno para comecar</p>
                </div>
              )}
              <StudentSearch />
              <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                <AlunoAvulsoForm />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MAIN CONTENT — Timetable direto, sem secoes intermediarias
          ============================================================ */}
      {currentStudent && (
        <main className="px-4 py-4 max-w-[1440px] mx-auto">
          {/* Toolbar: View toggle + title */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">
                Cronograma Semanal
              </h2>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-[#f1f5f9] rounded-lg">
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "kanban"
                    ? "bg-white text-[#1d1d1f] shadow-sm"
                    : "text-[#64748b] hover:text-[#1d1d1f]"
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                Kanban
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "timeline"
                    ? "bg-white text-[#1d1d1f] shadow-sm"
                    : "text-[#64748b] hover:text-[#1d1d1f]"
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Timeline
              </button>
            </div>
          </div>

          {/* History Panel — versões do cronograma */}
          <HistoryPanel />

          {/* Timetable */}
          <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] p-3">
            {viewMode === "kanban" ? (
              <KanbanBoard
                onSlotClick={handleSlotClick}
                onBlockEdit={handleBlockEdit}
              />
            ) : (
              <TimelineView
                dayDates={dayDates}
                onSlotClick={handleSlotClick}
                onBlockEdit={handleBlockEdit}
              />
            )}
          </div>
        </main>
      )}

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
