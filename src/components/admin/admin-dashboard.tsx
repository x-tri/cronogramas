import { lazy, Suspense, useState } from "react";
import type { AdminPage } from "../../types/admin";
import { AdminSidebar } from "./admin-sidebar";

const DashboardHome = lazy(() =>
  import("./dashboard-home").then((m) => ({ default: m.DashboardHome }))
);
const AdminCoordinadores = lazy(() =>
  import("./admin-coordenadores").then((m) => ({
    default: m.AdminCoordinadores,
  }))
);
const AdminHorarios = lazy(() =>
  import("./admin-horarios").then((m) => ({ default: m.AdminHorarios }))
);
const AdminControle = lazy(() =>
  import("./admin-controle").then((m) => ({ default: m.AdminControle }))
);
const AdminSimulados = lazy(() =>
  import("./admin-simulados").then((m) => ({ default: m.AdminSimulados }))
);
const AdminPdfs = lazy(() =>
  import("./admin-pdfs").then((m) => ({ default: m.AdminPdfs }))
);
const AuditLog = lazy(() =>
  import("./audit-log").then((m) => ({ default: m.AuditLog }))
);
const ApiMonitor = lazy(() =>
  import("./api-monitor").then((m) => ({ default: m.ApiMonitor }))
);
const AdminPerformance = lazy(() =>
  import("./admin-performance").then((m) => ({ default: m.AdminPerformance }))
);
const AdminGlinerOps = lazy(() =>
  import("./admin-gliner-ops").then((m) => ({
    default: m.AdminGlinerOps,
  }))
);

interface AdminDashboardProps {
  user: { name: string; email: string };
  userRole?: string | null;
  userSchoolId?: string | null;
  onLogout: () => void;
  onExit?: () => void;
}

const PAGE_TITLES: Readonly<Record<AdminPage, string>> = {
  overview: "Visão Executiva",
  coordinators: "Mentores & Acessos",
  schedules: "Grades Oficiais",
  control: "Cronogramas dos Alunos",
  simulados: "Simulados ENEM",
  performance: "Planos & Mentoria",
  content_mapping: "GLiNER Ops",
  pdfs: "PDFs & Entregas",
  audit: "Auditoria do Sistema",
  api: "Monitor API & IA",
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg
        className="animate-spin h-8 w-8 text-[#2563eb]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

function renderPage(page: AdminPage, params: {
  userRole: string | null;
  userSchoolId: string | null;
}) {
  const embeddedBack = () => {};

  switch (page) {
    case "overview":
      return (
        <DashboardHome
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "coordinators":
      return <AdminCoordinadores onBack={embeddedBack} />;
    case "schedules":
      return <AdminHorarios onBack={embeddedBack} />;
    case "control":
      return (
        <AdminControle
          onBack={embeddedBack}
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "simulados":
      return (
        <AdminSimulados
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "performance":
      return (
        <AdminPerformance
          embedded
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "content_mapping":
      return <AdminGlinerOps embedded />;
    case "pdfs":
      return (
        <AdminPdfs
          onBack={embeddedBack}
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "audit":
      return (
        <AuditLog
          userRole={params.userRole}
          userSchoolId={params.userSchoolId}
        />
      );
    case "api":
      return <ApiMonitor />;
    default: {
      const _exhaustive: never = page;
      return _exhaustive;
    }
  }
}

function getAvailablePages(userRole: string | null | undefined): AdminPage[] {
  // Coordinator NAO cai neste dashboard (roteamento em App.tsx manda para
  // o painel de mentor). Esta funcao existe apenas para super_admin hoje,
  // mas manter branch de coordinator e util caso super_admin impersone.
  if (userRole === "coordinator") {
    return ["control", "performance", "pdfs"];
  }

  // super_admin — tudo exceto GLiNER e API Monitor (dev-only)
  return [
    "overview",
    "coordinators",
    "schedules",
    "control",
    "simulados",
    "performance",
    "pdfs",
    "audit",
  ];
}

export function AdminDashboard({
  user,
  userRole = null,
  userSchoolId = null,
  onLogout,
  onExit,
}: AdminDashboardProps) {
  const availablePages = getAvailablePages(userRole);
  const [currentPage, setCurrentPage] = useState<AdminPage>(availablePages[0] ?? "overview");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AdminSidebar
        currentPage={currentPage}
        availablePages={availablePages}
        onNavigate={setCurrentPage}
        userName={user.name}
        userRole={userRole}
        onLogout={onLogout}
        onExit={onExit}
      />

      <main className="flex-1 flex flex-col bg-[#f5f5f7] overflow-hidden">
        {/* Header bar */}
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#e5e7eb]">
          <h1 className="text-lg font-semibold text-[#1d1d1f] md:ml-0 ml-12">
            {PAGE_TITLES[currentPage]}
          </h1>
          <span className="text-xs text-[#94a3b8] hidden sm:block">
            {user.email}
          </span>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <Suspense fallback={<LoadingSpinner />}>
            {renderPage(currentPage, {
              userRole,
              userSchoolId,
            })}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
