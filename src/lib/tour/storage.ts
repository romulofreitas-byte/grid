import type { TourSession } from "./machine";
import type { TourOrigin } from "./steps";

export const TOUR_SESSION_KEY = "grid_tour_session";
export const TOUR_DONE_PREFIX = "grid_tour_completed";

export type TourKv = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStore(kind: "local" | "session"): TourKv | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function tourDoneKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${TOUR_DONE_PREFIX}:${id}` : TOUR_DONE_PREFIX;
}

export function readTourSession(store?: TourKv | null): TourSession | null {
  const kv = store === undefined ? browserStore("session") : store;
  if (!kv) return null;
  try {
    const raw = kv.getItem(TOUR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourSession>;
    if (parsed.origin !== "app" && parsed.origin !== "landing") return null;
    if (typeof parsed.index !== "number" || !Number.isFinite(parsed.index)) {
      return null;
    }
    return { origin: parsed.origin, index: Math.max(0, Math.floor(parsed.index)) };
  } catch {
    return null;
  }
}

export function writeTourSession(
  session: TourSession,
  store?: TourKv | null,
): void {
  const kv = store === undefined ? browserStore("session") : store;
  if (!kv) return;
  try {
    kv.setItem(TOUR_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearTourSession(store?: TourKv | null): void {
  const kv = store === undefined ? browserStore("session") : store;
  if (!kv) return;
  try {
    kv.removeItem(TOUR_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isTourCompleted(
  userId?: string | null,
  store?: TourKv | null,
): boolean {
  const kv = store === undefined ? browserStore("local") : store;
  if (!kv) return false;
  try {
    return kv.getItem(tourDoneKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(
  userId?: string | null,
  store?: TourKv | null,
): void {
  const kv = store === undefined ? browserStore("local") : store;
  if (!kv) return;
  try {
    kv.setItem(tourDoneKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function clearTourCompleted(
  userId?: string | null,
  store?: TourKv | null,
): void {
  const kv = store === undefined ? browserStore("local") : store;
  if (!kv) return;
  try {
    kv.removeItem(tourDoneKey(userId));
  } catch {
    /* ignore */
  }
}

export function persistTourCompleted(
  origin: TourOrigin,
  signedIn: boolean,
  userId?: string | null,
  store?: TourKv | null,
): void {
  if (origin === "app" || signedIn) {
    markTourCompleted(userId, store);
  }
}
