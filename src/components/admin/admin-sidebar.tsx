import { useState, type ReactNode } from "react";
import type { AdminPage } from "../../types/admin";

interface AdminSidebarProps {
  currentPage: AdminPage;
  availablePages: ReadonlyArray<AdminPage>;
  onNavigate: (page: AdminPage) => void;
  userName: string;
  userRole?: string | null;
  onLogout: () => void;
  onExit?: () => void;
}

interface NavItem {
  readonly page: AdminPage;
  readonly label: string;
  readonly icon: ReactNode;
}

const iconProps = {
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    page: "overview",
    label: "Visão Executiva",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    page: "coordinators",
    label: "Mentores & Acessos",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    page: "schedules",
    label: "Grades Oficiais",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    page: "control",
    label: "Cronogramas dos Alunos",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    page: "performance",
    label: "Planos & Mentoria",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M4 19h16" />
        <path d="M7 16l3-5 3 2 4-7" />
        <circle cx="7" cy="16" r="1" />
        <circle cx="10" cy="11" r="1" />
        <circle cx="13" cy="13" r="1" />
        <circle cx="17" cy="6" r="1" />
      </svg>
    ),
  },
  {
    page: "content_mapping",
    label: "GLiNER Ops",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 4v4" />
        <path d="M12 16v4" />
        <path d="M4 12h4" />
        <path d="M16 12h4" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    page: "pdfs",
    label: "PDFs & Entregas",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    page: "audit",
    label: "Auditoria do Sistema",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    page: "api",
    label: "Monitor API & IA",
    icon: (
      <svg {...iconProps} viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="4" x2="10" y2="20" />
      </svg>
    ),
  },
] as const;

export function AdminSidebar({
  currentPage,
  availablePages,
  onNavigate,
  userName,
  userRole,
  onLogout,
  onExit,
}: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (page: AdminPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#e5e7eb]">
        <img src="/logo-xtri.png" alt="XTRI" className="h-8 w-auto" />
        <span className="text-sm font-semibold text-[#1d1d1f] hidden md:inline">
          {userRole === "coordinator" ? "Painel Coordenador" : "XTRI Admin"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter((item) => availablePages.includes(item.page)).map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => handleNavigate(item.page)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                transition-colors duration-150 cursor-pointer
                ${
                  isActive
                    ? "bg-[#eff6ff] text-[#2563eb] font-medium"
                    : "text-[#64748b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                }
              `}
              title={item.label}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="hidden md:inline truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#e5e7eb] px-4 py-4">
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="mb-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
              text-[#2563eb] hover:bg-[#eff6ff]
              transition-colors duration-150 cursor-pointer"
          >
            <svg
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M15 19l-7-7 7-7" />
              <path d="M19 12H8" />
            </svg>
            <span className="hidden md:inline">Voltar ao cronograma</span>
          </button>
        ) : null}
        <p
          className="text-xs font-medium text-[#1d1d1f] truncate hidden md:block mb-2"
          title={userName}
        >
          {userName}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
            text-[#94a3b8] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]
            transition-colors duration-150 cursor-pointer"
        >
          <svg
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg
          shadow-sm border border-[#e5e7eb] cursor-pointer"
        aria-label="Abrir menu"
      >
        <svg
          width={20}
          height={20}
          fill="none"
          stroke="#1d1d1f"
          strokeWidth={1.5}
          strokeLinecap="round"
          viewBox="0 0 24 24"
        >
          {mobileOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMobileOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label="Fechar menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static z-40 top-0 left-0 h-screen
          w-60 bg-white border-r border-[#e5e7eb]
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {navContent}
      </aside>
    </>
  );
}
