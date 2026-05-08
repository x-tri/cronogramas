import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useGamification } from "@/hooks/useGamification";
import { Button } from "@/components/ui/button";
import { LogOut, Flame, Zap } from "lucide-react";
import logoXtri from "@/assets/logo-xtri.png";

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "Aluno";
}

export default function StudentHeader() {
  const { signOut } = useAuth();
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: gamification } = useGamification(studentKey);
  const level = gamification?.level ?? 1;
  const displayName = firstName(student?.name);

  return (
    <header className="sticky top-0 z-40 border-b-2 bg-card/95 backdrop-blur px-4 py-2.5">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex min-w-0 items-center gap-2">
          <img src={logoXtri} alt="XTRI" className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0" title={student?.name ?? undefined}>
            <h1 className="truncate text-sm font-black text-foreground leading-tight">
              {displayName}
            </h1>
            <p className="truncate text-[11px] font-bold text-muted-foreground">
              {student?.turma ? `Turma ${student.turma}` : ""}
              {student?.matricula ? <span className="hidden sm:inline"> • {student.matricula}</span> : null}
            </p>
          </div>
        </div>
        <div className="ml-2 flex flex-shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-1" title={`Streak: ${gamification?.streak_weeks ?? 0} semanas`}>
            <Flame className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] font-black text-accent">{gamification?.streak_weeks ?? 0}</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-1" title={`${gamification?.title ?? "Calouro"} — ${gamification?.xp_total ?? 0} XP`}>
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary">{gamification?.xp_total ?? 0}</span>
            <span className="hidden text-[9px] font-bold text-primary/70 ml-0.5 sm:inline">{gamification?.title ?? "Calouro"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair" className="h-8 w-8 ml-1">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
