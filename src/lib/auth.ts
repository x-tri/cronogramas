export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

const API_URL = import.meta.env.VITE_XTRI_API_URL;

export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    const response = await fetch(API_URL + "/api/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: email, password }),
    });
    const user = (await response.json()).user as User;
    return user ?? null;
  } catch {
    return null;
  }
}

export function login(user: User): void {
  localStorage.setItem("token", user.token);
}

export function logout(): void {
  localStorage.removeItem("token");
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const response = await fetch(API_URL + "/api/users/me/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const user = (await response.json()).user as User;
    return user ?? null;
  } catch {
    return null;
  }
}
