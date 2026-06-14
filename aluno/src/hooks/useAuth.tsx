/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

type AuthProviderError = AuthError | Error;

interface AuthContextType {
  readonly user: User | null;
  readonly session: Session | null;
  readonly loading: boolean;
  readonly signIn: (matricula: string, password: string) => Promise<{ error: AuthError | null }>;
  readonly signInWithGoogle: () => Promise<{ error: AuthProviderError | null }>;
  readonly signInWithApple: () => Promise<{ error: AuthProviderError | null }>;
  readonly signOut: () => Promise<void>;
}

const EMAIL_DOMAIN = "aluno.xtri.com";
const GOOGLE_AUTH_OVERRIDE = import.meta.env.VITE_ENABLE_GOOGLE_AUTH;
const APPLE_AUTH_OVERRIDE = import.meta.env.VITE_ENABLE_APPLE_AUTH;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_KEY;
const providerStatusCache = new Map<"google" | "apple", boolean>();

function getProviderDisabledMessage(provider: "Google" | "Apple"): string {
  return `Login com ${provider} não está habilitado neste ambiente. Habilite o provider ${provider} no Supabase antes de usar este acesso.`;
}

async function isOAuthProviderEnabled(provider: "google" | "apple"): Promise<boolean> {
  const override = provider === "google" ? GOOGLE_AUTH_OVERRIDE : APPLE_AUTH_OVERRIDE;
  if (override === "false") {
    return false;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return false;
  }

  const cachedStatus = providerStatusCache.get(provider);
  if (cachedStatus !== undefined) {
    return cachedStatus;
  }

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      providerStatusCache.set(provider, false);
      return false;
    }

    const settings = (await response.json()) as {
      external?: Partial<Record<"google" | "apple", boolean>>;
    };
    const enabled = settings.external?.[provider] === true;
    providerStatusCache.set(provider, enabled);
    return enabled;
  } catch {
    providerStatusCache.set(provider, false);
    return false;
  }
}

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
    if (!(await isOAuthProviderEnabled("google"))) {
      return { error: new Error(getProviderDisabledMessage("Google")) };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getStudentAuthRedirectUrl(),
      },
    });
    return { error };
  };

  const signInWithApple = async () => {
    if (!(await isOAuthProviderEnabled("apple"))) {
      return { error: new Error(getProviderDisabledMessage("Apple")) };
    }

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
