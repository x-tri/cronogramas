import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

interface AuthContextType {
  readonly user: User | null;
  readonly session: Session | null;
  readonly loading: boolean;
  readonly signIn: (matricula: string, password: string) => Promise<{ error: AuthError | null }>;
  readonly signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  readonly signInWithApple: () => Promise<{ error: AuthError | null }>;
  readonly signOut: () => Promise<void>;
}

const EMAIL_DOMAIN = "aluno.xtri.com";

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function getStudentAuthRedirectUrl(): string {
  const currentUrl = new URL(window.location.href);
  currentUrl.hash = "";
  currentUrl.search = "";
  return currentUrl.toString();
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Padrão recomendado Supabase v2: APENAS onAuthStateChange
    // Não usar getSession() separado — causa race condition com OAuth callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (matricula: string, password: string) => {
    const email = `${matricula.trim()}@${EMAIL_DOMAIN}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getStudentAuthRedirectUrl(),
      },
    });
    return { error };
  };

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: getStudentAuthRedirectUrl(),
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
