import { withBase } from "./base";

const TOKEN_KEY = "rizz-admin-token";
const LEGACY_TOKEN_KEY = "admin_token";
const ADMIN_KEY = "admin_user";
const REMEMBER_KEY = "admin_remember";

export type AdminProfile = {
  id: string;
  firstName: string;
  email: string;
  role: string;
  createdAt?: string | null;
};

function storageForRemember(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

export function getToken(): string | null {
  return (
    localStorage.getItem(TOKEN_KEY) ??
    sessionStorage.getItem(TOKEN_KEY) ??
    localStorage.getItem(LEGACY_TOKEN_KEY) ??
    sessionStorage.getItem(LEGACY_TOKEN_KEY)
  );
}

export function getStoredAdmin(): AdminProfile | null {
  const raw =
    localStorage.getItem(ADMIN_KEY) ?? sessionStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

export function setAuthSession(
  token: string,
  admin: AdminProfile,
  remember: boolean,
) {
  clearAuthSession();
  const store = storageForRemember(remember);
  store.setItem(TOKEN_KEY, token);
  store.setItem(ADMIN_KEY, JSON.stringify(admin));
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function setStoredAdmin(admin: AdminProfile) {
  const remember = localStorage.getItem(REMEMBER_KEY) !== "0";
  const store = storageForRemember(remember);
  if (!getToken()) return;
  store.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearAuthSession() {
  for (const key of [TOKEN_KEY, LEGACY_TOKEN_KEY]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

/** Full logout: clear storage and hard-reload to login. */
export function forceLogoutToLogin() {
  clearAuthSession();
  window.location.href = withBase("/signin");
}
