/** Fill-height split used by ficha, Box, and work surfaces. */
export const workSplitClass =
  "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain lg:h-0 lg:flex-row lg:overflow-hidden";

/** Narrow column (list, identity, focus). */
export const workSplitRailClass =
  "flex min-h-0 w-full flex-col lg:h-full lg:w-[22rem] lg:shrink-0 lg:overflow-y-scroll lg:overscroll-contain lg:[scrollbar-gutter:stable]";

/** Wide column (detail, form, board). */
export const workSplitPaneClass =
  "min-h-0 min-w-0 lg:h-full lg:min-w-0 lg:flex-1 lg:overflow-y-scroll lg:overscroll-contain lg:[scrollbar-gutter:stable]";
