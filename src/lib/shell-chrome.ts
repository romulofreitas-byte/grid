/** Shared mobile chrome: tab-bar offset, safe-area, and overlay stack. */

export const SHELL_Z = {
  header: "z-40",
  tab: "z-40",
  context: "z-[45]",
  toast: "z-50",
  modal: "z-[70]",
  confirm: "z-[80]",
  celebration: "z-[90]",
} as const;

/** Main scroll pad so content clears the phone tab bar. */
export const SHELL_TAB_PAD =
  "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-16";

/** Locked-height surfaces (Box, CRM) — smaller desktop pad. */
export const SHELL_TAB_PAD_LOCK =
  "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8";

/** Context bar sits above the tab bar on phones; flush once the rail takes over. */
export const SHELL_CONTEXT_BOTTOM =
  "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0";

/** Spacer matching the context bar so the last row is not covered. */
export const SHELL_CONTEXT_SPACER = "h-20 md:h-16";

/** Margin twin of the spacer, for in-flow actions above the context bar. */
export const SHELL_CONTEXT_MARGIN = "mb-20 md:mb-16";

/** Toasts sit above the tab bar (and any one context bar). */
export const SHELL_TOAST_BOTTOM =
  "bottom-[calc(9.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6";

/** Focus chip sits just above the tab bar on phones. */
export const SHELL_FOCUS_BADGE_BOTTOM =
  "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4";
