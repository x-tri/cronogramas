import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { StudentSearch } from "./components/student/student-search";
import { AlunoAvulsoForm } from "./components/student/aluno-avulso-form";
import { KanbanBoard } from "./components/kanban/kanban-board";
import { BlockEditorModal } from "./components/blocks/block-editor-modal";
import { HistoryPanel } from "./components/cronograma/history-panel";
import { WeekSelector } from "./components/week-selector";
import { ResetButton } from "./components/cronograma/reset-button";
import { useCronogramaStore } from "./stores/cronograma-store";
import type { BlocoCronograma, DiaSemana, Turno } from "./types/domain";
import { TURNOS_CONFIG } from "./constants/time-slots";
import { getWeekBounds } from "./components/week-utils";
import { getCurrentUser, logout, type User } from "./lib/auth";
import { LoginForm } from "./components/login-form";
import { ChangePasswordForm } from "./components/change-password-form";
import { LinkInviteCode } from "./components/link-invite-code";
import { TimelineView } from "./components/kanban/timeline-view";
import {
  clearCurrentProjectUserCache,
  getCurrentProjectUser,
} from "./lib/project-user";
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

const AdminDashboard = lazy(() =>
  import("./components/admin/admin-dashboard").then((mod) => ({
    default: mod.AdminDashboard,
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
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!isMounted) return;
        setUser(currentUser);
        if (currentUser) {
          const projectUser = await getCurrentProjectUser(true);
          if (isMounted) {
            setUserRole(projectUser?.role ?? null);
            setUserSchoolId(projectUser?.schoolId ?? null);
            setMustChangePassword(projectUser?.mustChangePassword ?? false);
          }
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

  // Detecta expiração/invalidação de sessão e força re-login
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionLost =
        event === "SIGNED_OUT" ||
        (event === "TOKEN_REFRESHED" && !session) ||
        (event === "INITIAL_SESSION" && !session);

      if (sessionLost) {
        clearCurrentProjectUserCache();
        setUser(null);
        setUserRole(null);
        setUserSchoolId(null);
        setMustChangePassword(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentStudent) {
      setShowSearch(false);
    }
  }, [currentStudent]);

  async function handleLoginSuccess() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const projectUser = await getCurrentProjectUser(true);
        setUserRole(projectUser?.role ?? null);
        setUserSchoolId(projectUser?.schoolId ?? null);
        setMustChangePassword(projectUser?.mustChangePassword ?? false);
      }
    } catch {
      console.error("Erro ao obter usuario apos login");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearCurrentProjectUserCache();
      setUser(null);
      setUserRole(null);
      setUserSchoolId(null);
      setMustChangePassword(false);
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

  if (mustChangePassword) {
    return (
      <ChangePasswordForm
        userName={user.name}
        onSuccess={() => setMustChangePassword(false)}
      />
    );
  }

  // Google user sem project_users vinculado → tela de código de convite
  if (user && !userRole) {
    return (
      <LinkInviteCode
        userName={user.name}
        userEmail={user.email}
        onSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    );
  }

  // super_admin e coordinator acessam AdminDashboard. Coordinator ve um
  // subconjunto das paginas (scoped a sua escola) via getAvailablePages em
  // admin-dashboard.tsx.
  if (userRole === "super_admin" || userRole === "coordinator") {
    return (
      <Suspense fallback={
        <main className="flex min-h-svh items-center justify-center bg-[#fafafa]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
        </main>
      }>
        <AdminDashboard
          user={user}
          userRole={userRole}
          userSchoolId={userSchoolId}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  const isSearchModalOpen = Boolean(currentStudent && showSearch);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-[rgba(255,255,255,0.88)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-4 py-2.5">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ffffff_0%,#edf4ff_52%,#fff4ef_100%)] shadow-[0_12px_28px_-18px_rgba(37,99,235,0.7)] ring-1 ring-[#dbe5f3]">
                  <img src="/logo-xtri.png" alt="XTRI" className="h-8 w-8 flex-shrink-0" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                    Sessão de mentoria
                  </p>
                  <p className="text-sm font-semibold text-[#1d1d1f]">
                    Análise do simulado e cronograma do aluno
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="hidden rounded-2xl border border-[#e5e7eb] bg-white/80 px-3 py-2 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.5)] sm:flex sm:flex-col sm:items-end">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
                    Coordenador ativo
                  </span>
                  <span className="mt-0.5 text-sm font-medium text-[#1d1d1f]">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-3.5 text-xs font-semibold text-[#475569] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </div>

            {currentStudent && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-[24px] border border-[#e5e7eb] bg-white/94 px-4 py-3 xl:w-[360px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">
                        {currentStudent.nome}
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748b]">
                        Turma {currentStudent.turma} · {currentStudent.matricula}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSearch(true)}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-3.5 text-sm font-medium text-[#1d4ed8] transition-colors hover:border-[#bfdbfe] hover:bg-white"
                      title="Trocar aluno"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Trocar aluno
                    </button>
                  </div>

                  <div className="min-w-0 flex-1 rounded-[24px] border border-[#e5e7eb] bg-white/94 px-3 py-2">
                    <WeekSelector variant="compact" />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <Suspense fallback={null}>
                    <SimuladoAnalyzer
                      matricula={currentStudent.matricula}
                      variant="compact"
                    />
                  </Suspense>
                  <ResetButton />
                  <Suspense fallback={null}>
                    <ShareDropdown />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {!currentStudent && (
        <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-[860px] flex-col justify-center px-4 pb-12 pt-8">
          <section className="rounded-[32px] border border-[#e5e7eb] bg-white/95 p-6 shadow-[0_28px_60px_-46px_rgba(15,23,42,0.4)] sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f8fafc] text-[#2563eb]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="mx-auto mt-6 max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                Abrir planejamento
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
                Selecione um aluno.
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#64748b] sm:text-base">
                Busque a matrícula para carregar horário, simulado e cronograma sem ruído visual na entrada.
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-[#eef2f7] bg-[#f8fafc] p-5 sm:p-6">
              <StudentSearch variant="hero" />
            </div>
          </section>

          <section className="mt-4 rounded-[28px] border border-[#e5e7eb] bg-white/92 p-5 shadow-[0_24px_48px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-sm font-semibold text-[#111827]">
              Aluno avulso ou XTRI
            </p>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Use o cadastro manual apenas quando a matrícula ainda não estiver disponível.
            </p>
            <div className="mt-4">
              <AlunoAvulsoForm variant="panel" />
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          SEARCH OVERLAY — aparece como modal quando necessario
          ============================================================ */}
      {isSearchModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 pt-20 backdrop-blur-sm"
          onClick={() => setShowSearch(false)}
        >
          <div
            className="mx-4 w-full max-w-lg animate-apple-scale-in rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1d1d1f]">Trocar aluno</h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Busque outra matrícula para atualizar o contexto do cronograma.
                  </p>
                </div>
                <button
                  onClick={() => setShowSearch(false)}
                  className="rounded-lg p-1.5 text-[#94a3b8] transition-colors hover:bg-[#f1f1ef] hover:text-[#1d1d1f]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <StudentSearch variant="modal" />
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
