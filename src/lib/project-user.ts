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

type ProjectUserRow = {
  id: string;
  role: string | null;
  school_id: string | null;
  name: string | null;
  must_change_password: boolean | null;
  auth_uid: string | null;
};

export function clearCurrentProjectUserCache(): void {
  cachedProjectUser = null;
  projectUserPromise = null;
}

export function isSchoolScopedProjectUser(
  projectUser: CurrentProjectUser | null,
): boolean {
  return Boolean(projectUser?.schoolId && projectUser.role !== "super_admin");
}

function toCurrentProjectUser(
  userId: string,
  projectUser: ProjectUserRow,
): CurrentProjectUser {
  return {
    userId,
    role: projectUser.role ?? "coordinator",
    schoolId: projectUser.school_id ?? null,
    name: projectUser.name ?? null,
    mustChangePassword: Boolean(projectUser.must_change_password),
  };
}

async function getProjectUserByAuthUid(
  authUid: string,
): Promise<ProjectUserRow | null> {
  const { data, error } = await supabase
    .from("project_users")
    .select("id, role, school_id, name, must_change_password, auth_uid")
    .eq("auth_uid", authUid)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProjectUserRow;
}

async function getProjectUserByEmail(email: string): Promise<ProjectUserRow | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("project_users")
    .select("id, role, school_id, name, must_change_password, auth_uid")
    .ilike("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProjectUserRow;
}

async function relinkProjectUserAuthUid(
  projectUserId: string,
  authUid: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("project_users")
    .update({ auth_uid: authUid })
    .eq("id", projectUserId)
    .is("auth_uid", null);

  return !error;
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

    const linkedProjectUser = await getProjectUserByAuthUid(user.id);
    if (linkedProjectUser) {
      const resolvedProjectUser = toCurrentProjectUser(user.id, linkedProjectUser);
      cachedProjectUser = {
        expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
        value: resolvedProjectUser,
      };
      return resolvedProjectUser;
    }

    const emailProjectUser = user.email
      ? await getProjectUserByEmail(user.email)
      : null;

    if (!emailProjectUser) {
      cachedProjectUser = {
        expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
        value: null,
      };
      return null;
    }

    if (emailProjectUser.auth_uid === null) {
      const relinked = await relinkProjectUserAuthUid(emailProjectUser.id, user.id);
      if (!relinked) {
        cachedProjectUser = {
          expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
          value: null,
        };
        return null;
      }
    }

    if (emailProjectUser.auth_uid && emailProjectUser.auth_uid !== user.id) {
      cachedProjectUser = {
        expiresAt: now + PROJECT_USER_CACHE_TTL_MS,
        value: null,
      };
      return null;
    }

    const resolvedProjectUser = toCurrentProjectUser(user.id, emailProjectUser);

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
