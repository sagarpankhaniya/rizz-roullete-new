/** Vite base path without trailing slash (e.g. `/admin`). */
export const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

/** Prefix an absolute app path with the Vite base (e.g. `/signin` → `/admin/signin`). */
export function withBase(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!APP_BASE) return normalized;
  return `${APP_BASE}${normalized}`;
}

/** Public asset URL under the Vite base (e.g. `images/logo.svg`). */
export function assetUrl(path: string) {
  const cleaned = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${cleaned}`;
}
