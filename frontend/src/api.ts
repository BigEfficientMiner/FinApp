// Talking to the Python backend (server.py).
// The session token from logging in is kept in localStorage and sent on every request.

export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "https://finapp-backend.up.railway.app" : "http://localhost:8000");
const TOKEN_KEY = "finapp_token";

export type BankLink = { nessie_customer_id: string; linked_at: string };
export type Me = { id: number; username: string; display_name: string; bank_link: BankLink | null };

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  lastGood.clear(); // different user (or logged out): never show someone else's cached data
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private window, etc.): you'll just need to log in again next time.
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Called when the server says the session is no longer valid (App.tsx sends you back to login).
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// ---------- Speed: show the last answer instantly, share identical requests ----------
// Every successful GET is remembered, so switching back to a tab can draw right
// away with `cached(path)` while a fresh copy loads. Identical GETs that are
// already on their way (e.g. a poll and a tab switch) share one request.
const lastGood = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

export function cached<T>(path: string): T | undefined {
  return lastGood.get(path) as T | undefined;
}

export function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (method !== "GET") return request<T>(method, path, body);
  const running = inFlight.get(path);
  if (running) return running as Promise<T>;
  const token = getToken();
  const p = request<T>(method, path)
    .then((data) => {
      if (getToken() === token) lastGood.set(path, data);
      return data;
    })
    .finally(() => inFlight.delete(path));
  inFlight.set(path, p);
  return p;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${API_URL}. Is server.py running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    onUnauthorized();
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}
