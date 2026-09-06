export const FOCUS_MD_QUERY = "(min-width: 768px)";
export const FOCUS_REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
/** Chrome slide duration; fullscreen waits for this so the browser snap is not the first frame. */
export const FOCUS_CHROME_MS = 320;
export const FOCUS_SPRINT_MS = 25 * 60 * 1000;

export function focusFullscreenDelayMs(reduceMotion: boolean): number {
  return reduceMotion ? 0 : FOCUS_CHROME_MS;
}

export function prefersFocusReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(FOCUS_REDUCE_QUERY).matches;
}

export function focusSprintRemainingMs(
  startedAt: number,
  now: number,
  durationMs = FOCUS_SPRINT_MS,
): number {
  return Math.min(durationMs, Math.max(0, durationMs - (now - startedAt)));
}

export function formatFocusSprintClock(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const FOCUS_SISTEMA_PREFIXES = [
  "/conta",
  "/planos",
  "/duvidas",
  "/integracoes",
  "/importacoes",
  "/automacoes",
  "/pagar",
] as const;

/** Focus is session-only; the flag is for tests and a stable on/off encoding. */
export function parseFocusOn(raw: string | null): boolean {
  return raw === "1";
}

export function serializeFocusOn(on: boolean): "0" | "1" {
  return on ? "1" : "0";
}

export function isFocusSistemaPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return FOCUS_SISTEMA_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export type FullscreenHost = {
  readonly fullscreenElement: Element | null;
  request: () => Promise<void>;
  exit: () => Promise<void>;
};

export function isFullscreen(host: Pick<FullscreenHost, "fullscreenElement">): boolean {
  return Boolean(host.fullscreenElement);
}

export async function enterFullscreen(host: FullscreenHost): Promise<boolean> {
  if (host.fullscreenElement) return true;
  try {
    await host.request();
    return true;
  } catch {
    return false;
  }
}

export async function leaveFullscreen(host: FullscreenHost): Promise<void> {
  if (!host.fullscreenElement) return;
  try {
    await host.exit();
  } catch {
    /* already left */
  }
}

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type FsEl = Element & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export function readFullscreenElement(doc: Document): Element | null {
  const d = doc as FsDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function fullscreenHostFromDocument(doc: Document): FullscreenHost {
  const d = doc as FsDoc;
  const el = d.documentElement as FsEl;
  return {
    get fullscreenElement() {
      return readFullscreenElement(doc);
    },
    request: () => {
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
      return Promise.reject(new Error("unsupported"));
    },
    exit: () => {
      if (d.exitFullscreen) return d.exitFullscreen();
      if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
      return Promise.resolve();
    },
  };
}

export async function requestAppFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  return enterFullscreen(fullscreenHostFromDocument(document));
}

export async function exitAppFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  await leaveFullscreen(fullscreenHostFromDocument(document));
}
