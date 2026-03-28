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
const AdminPdfs = lazy(() =>
  import("./admin-pdfs").then((m) => ({ default: m.AdminPdfs }))
);
const AuditLog = lazy(() =>
  import("./audit-log").then((m) => ({ default: m.AuditLog }))
);
const ApiMonitor = lazy(() =>
  import("./api-monitor").then((m) => ({ default: m.ApiMonitor }))
);

interface AdminDashboardProps {
  user: { name: string; email: string };
  onLogout: () => void;
}

const PAGE_TITLES: Readonly<Record<AdminPage, string>> = {
  overview: "Visao Geral",
  coordinators: "Coordenadores",
  schedules: "Horarios de Aula",
  control: "Controle de Cronogramas",
  pdfs: "Historico de PDFs",
  audit: "Auditoria",
  api: "API & IA",
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

function renderPage(page: AdminPage) {
  const embeddedBack = () => {};

  switch (page) {
    case "overview":
      return <DashboardHome />;
    case "coordinators":
      return <AdminCoordinadores onBack={embeddedBack} />;
    case "schedules":
      return <AdminHorarios onBack={embeddedBack} />;
    case "control":
      return <AdminControle onBack={embeddedBack} />;
    case "pdfs":
      return <AdminPdfs onBack={embeddedBack} />;
    case "audit":
      return <AuditLog />;
    case "api":
      return <ApiMonitor />;
    default: {
      const _exhaustive: never = page;
      return _exhaustive;
    }
  }
}

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [currentPage, setCurrentPage] = useState<AdminPage>("overview");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AdminSidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        userName={user.name}
        onLogout={onLogout}
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
            {renderPage(currentPage)}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
