export const SHELL_RAIL_STORAGE_KEY = "grid-shell-rail";
export const SHELL_RAIL_ACCORDION_KEY = "grid-shell-rail-accordion";

/** First visit: open, so labels teach the IA. */
export function parseShellRailOpen(raw: string | null): boolean {
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
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
