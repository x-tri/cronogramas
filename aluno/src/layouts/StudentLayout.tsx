import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StudentHeader from "@/components/StudentHeader";
import BottomNav from "@/components/BottomNav";
import ChangePassword from "@/pages/ChangePassword";
import LinkMatricula from "@/pages/LinkMatricula";
import { Loader2 } from "lucide-react";

export default function StudentLayout() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Verificar se tem student vinculado a este auth user
  const { data: studentLink, isLoading: loadingStudent } = useQuery({
    queryKey: ["student-link", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, matricula, name")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Verificar project_users (para must_change_password)
  const { data: projectUser, isLoading: loadingPU } = useQuery({
    queryKey: ["project-user-self", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_users")
        .select("must_change_password")
        .eq("auth_uid", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (loading || loadingStudent || loadingPU) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Usuário autenticado mas sem student vinculado → tela de vinculação
  if (!studentLink) {
    return (
      <LinkMatricula
        onLinked={() => {
          void queryClient.invalidateQueries({ queryKey: ["student-link"] });
          void queryClient.invalidateQueries({ queryKey: ["project-user-self"] });
          void queryClient.invalidateQueries({ queryKey: ["student-profile"] });
        }}
      />
    );
  }

  // Forçar troca de senha (apenas para login por matrícula, não Google)
  const isGoogleUser = user.app_metadata?.provider === "google";
  if (!isGoogleUser && projectUser?.must_change_password && !passwordChanged) {
    return (
      <ChangePassword
        onComplete={() => {
          setPasswordChanged(true);
          queryClient.invalidateQueries({ queryKey: ["project-user-self"] });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StudentHeader />
      <main className="pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
