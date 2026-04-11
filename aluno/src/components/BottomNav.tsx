import { NavLink } from "react-router-dom";
import { Calendar, BarChart3, FileSearch, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", icon: Calendar, label: "Cronograma", emoji: "📅" },
  { to: "/desempenho", icon: BarChart3, label: "Evolução", emoji: "📊" },
  { to: "/analise", icon: FileSearch, label: "Análise", emoji: "🔍" },
  { to: "/avisos", icon: Bell, label: "Avisos", emoji: "🔔" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-bold transition-all rounded-xl",
                isActive
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                  isActive ? "bg-primary/15" : ""
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "animate-pop")} />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
