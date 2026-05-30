// Configurable backend URL for the multiplayer/auth/quests/friends API.
// Defaults to relative "/api" (works when proxied), but you can point this at
// the Replit api-server by setting VITE_GAME_API_URL in your .env file.
const RAW = (import.meta as any).env?.VITE_GAME_API_URL as string | undefined;

export const API_BASE: string = (RAW && RAW.trim().length > 0 ? RAW.replace(/\/+$/, "") : "/api");

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

export function wsUrl(): string {
  if (typeof window === "undefined") return "";
  // If user pointed API at an absolute http(s) URL, derive ws(s) host from it.
  if (/^https?:\/\//i.test(API_BASE)) {
    const u = new URL(API_BASE);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}${u.pathname.replace(/\/+$/, "")}/ws`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${API_BASE}/ws`;
}