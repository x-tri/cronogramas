import { supabase } from "./supabase";

export interface CurrentProjectUser {
  userId: string;
  role: string;
  schoolId: string | null;
  name: string | null;
  mustChangePassword: boolean;
}

type CachedProjectUser = {
  expiresAt: number;
  value: CurrentProjectUser | null;
};

const PROJECT_USER_CACHE_TTL_MS = 30_000;

let cachedProjectUser: CachedProjectUser | null = null;
let projectUserPromise: Promise<CurrentProjectUser | null> | null = null;

export function clearCurrentProjectUserCache(): void {
  cachedProjectUser = null;
  projectUserPromise = null;
}

export function isSchoolScopedProjectUser(
  projectUser: CurrentProjectUser | null,
): boolean {
  return Boolean(projectUser?.schoolId && projectUser.role !== "super_admin");
}

export async function getCurrentProjectUser(
  forceRefresh = false,
): Promise<CurrentProjectUser | null> {
  const now = Date.now();

  if (!forceRefresh && cachedProjectUser && cachedProjectUser.expiresAt > now) {
    return cachedProjectUser.value;
  }

  if (!forceRefresh && projectUserPromise) {
    return projectUserPromise;
  }

  projectUserPromise = (async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      cachedProjectUser = {
        expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
        value: null,
      };
      return null;
    }

    const { data: projectUser, error } = await supabase
      .from("project_users")
      .select("role, school_id, name, must_change_password")
      .eq("auth_uid", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !projectUser) {
      cachedProjectUser = {
        expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
        value: null,
      };
      return null;
    }

    const resolvedProjectUser: CurrentProjectUser = {
      userId: user.id,
      role: (projectUser.role as string | null) ?? "coordinator",
      schoolId: (projectUser.school_id as string | null) ?? null,
      name: (projectUser.name as string | null) ?? null,
      mustChangePassword: Boolean(projectUser.must_change_password),
    };

    cachedProjectUser = {
      expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
      value: resolvedProjectUser,
    };

    return resolvedProjectUser;
  })();

  try {
    return await projectUserPromise;
  } finally {
    projectUserPromise = null;
  }
}
