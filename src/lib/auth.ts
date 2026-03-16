import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../config/repository-config";
import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

const AUTH_EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN;
const AUTH_EMAIL_DOMAINS = import.meta.env.VITE_AUTH_EMAIL_DOMAINS;
const AUTH_USERNAME_TABLE = import.meta.env.VITE_AUTH_USERNAME_TABLE;
const AUTH_USERNAME_COLUMN = import.meta.env.VITE_AUTH_USERNAME_COLUMN;
const AUTH_EMAIL_COLUMN = import.meta.env.VITE_AUTH_EMAIL_COLUMN ?? "email";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

async function clearStaleSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignora falhas ao limpar sessão inválida.
  }
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getDisplayName(user: SupabaseAuthUser): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  return (
    toStringOrNull(metadata?.name) ??
    toStringOrNull(metadata?.full_name) ??
    toStringOrNull(metadata?.username) ??
    toStringOrNull(user.email) ??
    toStringOrNull(user.phone) ??
    "Professor"
  );
}

function mapSupabaseUser(user: SupabaseAuthUser, token: string): User {
  return {
    id: user.id,
    name: getDisplayName(user),
    email: user.email ?? user.phone ?? "",
    password: "",
    token,
  };
}

function normalizeDomain(domain: string): string {
  return domain.startsWith("@") ? domain.slice(1) : domain;
}

function extractDomains(): string[] {
  const fromSingle = AUTH_EMAIL_DOMAIN?.trim() ? [AUTH_EMAIL_DOMAIN.trim()] : [];
  const fromList =
    AUTH_EMAIL_DOMAINS?.split(",")
      .map((item: string) => item.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...fromSingle, ...fromList].map(normalizeDomain)));
}

async function resolveEmailFromUsername(identifier: string): Promise<string | null> {
  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    !AUTH_USERNAME_TABLE ||
    !AUTH_USERNAME_COLUMN ||
    !AUTH_EMAIL_COLUMN
  ) {
    return null;
  }

  try {
    const apiUrl = new URL(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${AUTH_USERNAME_TABLE}`,
    );
    apiUrl.searchParams.set("select", AUTH_EMAIL_COLUMN);
    apiUrl.searchParams.set(AUTH_USERNAME_COLUMN, `eq.${identifier}`);
    apiUrl.searchParams.set("limit", "1");

    const response = await fetch(apiUrl.toString(), {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (!rows.length) return null;

    return toStringOrNull(rows[0][AUTH_EMAIL_COLUMN]);
  } catch {
    return null;
  }
}

async function buildEmailCandidates(identifier: string): Promise<string[]> {
  if (identifier.includes("@")) return [identifier];

  const candidates = new Set<string>();

  const resolvedEmail = await resolveEmailFromUsername(identifier);
  if (resolvedEmail) candidates.add(resolvedEmail);

  const normalizedIdentifier = identifier.toLowerCase();
  for (const domain of extractDomains()) {
    candidates.add(`${identifier}@${domain}`);
    candidates.add(`${normalizedIdentifier}@${domain}`);
  }

  candidates.add(identifier);
  candidates.add(normalizedIdentifier);

  return Array.from(candidates);
}

export async function authenticate(
  username: string,
  password: string,
): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const identifier = username.trim();
  if (!identifier || !password) return null;

  try {
    const emails = await buildEmailCandidates(identifier);

    for (const email of emails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error && data.user && data.session) {
        return mapSupabaseUser(data.user, data.session.access_token);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function login(_user: User): void {
  // A sessão já é persistida automaticamente pelo Supabase client.
  void _user;
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut({ scope: "local" });
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      await clearStaleSession();
      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return mapSupabaseUser(user, session?.access_token ?? "");
  } catch {
    await clearStaleSession();
    return null;
  }
}
