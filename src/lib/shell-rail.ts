export const SHELL_RAIL_STORAGE_KEY = "grid-shell-rail";
export const SHELL_RAIL_ACCORDION_KEY = "grid-shell-rail-accordion";
export const SHELL_RAIL_LOGIN_COOKIE = "grid-shell-rail-login";
/** Long enough for the auth redirect to land, short enough to ignore later. */
export const SHELL_RAIL_LOGIN_MAX_AGE_SECONDS = 5 * 60;
export const CRM_NICHO_RAIL_STORAGE_KEY = "grid-crm-nicho-rail";

/** First visit: open, so labels teach the IA. */
export function parseShellRailOpen(raw: string | null): boolean {
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
}

/** A fresh login reopens the rail even when the last visit left it collapsed. */
export function resolveShellRailOpen(
  stored: string | null,
  loginMarker: boolean,
): boolean {
  if (loginMarker) return true;
  return parseShellRailOpen(stored);
}

export function shellRailLoginMarkerPresent(
  cookieHeader: string | null | undefined,
): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === SHELL_RAIL_LOGIN_COOKIE) {
      return rest.join("=").trim() === "1";
    }
  }
  return false;
}

/** Drop the login cookie after the shell has read it. */
export function consumeShellRailLoginMarker(): boolean {
  if (typeof document === "undefined") return false;
  if (!shellRailLoginMarkerPresent(document.cookie)) return false;
  document.cookie = `${SHELL_RAIL_LOGIN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return true;
}

/** Close the CRM nicho rail and keep its width. Null means nothing to write. */
export function crmNichoRailClosedForLogin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { width?: unknown };
    if (!parsed || typeof parsed !== "object") {
      return JSON.stringify({ open: false });
    }
    const width =
      typeof parsed.width === "number" && Number.isFinite(parsed.width)
        ? parsed.width
        : undefined;
    return JSON.stringify(
      width === undefined ? { open: false } : { open: false, width },
    );
  } catch {
    return null;
  }
}

export function serializeShellRailOpen(open: boolean): "0" | "1" {
  return open ? "1" : "0";
}

export function readShellRailOpen(): boolean {
  try {
    return parseShellRailOpen(localStorage.getItem(SHELL_RAIL_STORAGE_KEY));
  } catch {
    return true;
  }
}

export function shellRailWidthClass(open: boolean): string {
  return open ? "w-[12.5rem]" : "w-16";
}

export function writeShellRailOpen(open: boolean) {
  try {
    localStorage.setItem(
      SHELL_RAIL_STORAGE_KEY,
      serializeShellRailOpen(open),
    );
  } catch {
    /* quota / private mode */
  }
}

/** Each login starts with labels visible. The CRM nicho rail yields so both are not open. */
export function applyShellRailLoginOpen() {
  writeShellRailOpen(true);
  try {
    const next = crmNichoRailClosedForLogin(
      localStorage.getItem(CRM_NICHO_RAIL_STORAGE_KEY),
    );
    if (next) localStorage.setItem(CRM_NICHO_RAIL_STORAGE_KEY, next);
  } catch {
    /* quota / private mode */
  }
}

export function parseShellRailExpanded(raw: string | null): string | null {
  const key = raw?.trim() ?? "";
  return key.length > 0 ? key : null;
}

export function readShellRailExpanded(): string | null {
  try {
    return parseShellRailExpanded(localStorage.getItem(SHELL_RAIL_ACCORDION_KEY));
  } catch {
    return null;
  }
}

export function writeShellRailExpanded(key: string | null) {
  try {
    if (key) localStorage.setItem(SHELL_RAIL_ACCORDION_KEY, key);
    else localStorage.removeItem(SHELL_RAIL_ACCORDION_KEY);
  } catch {
    /* quota / private mode */
  }
}

export type CrmRailsState = {
  shellOpen: boolean;
  nichoOpen: boolean;
};

export type CrmRailsChange = {
  shellOpen?: boolean;
  nichoOpen?: boolean;
};

/** On /crm, both rails cannot stay open. Closing either is always allowed. */
export function exclusiveCrmRails(
  current: CrmRailsState,
  change: CrmRailsChange = {},
): CrmRailsState {
  const next: CrmRailsState = {
    shellOpen: change.shellOpen ?? current.shellOpen,
    nichoOpen: change.nichoOpen ?? current.nichoOpen,
  };
  if (!next.shellOpen || !next.nichoOpen) return next;
  if (change.shellOpen === true && change.nichoOpen !== true) {
    return { shellOpen: true, nichoOpen: false };
  }
  return { shellOpen: false, nichoOpen: true };
}
