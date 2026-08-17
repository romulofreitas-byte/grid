import { DEFAULT_FILTERS, type SearchFilters } from "@/lib/types";
import { filterStepFilled, qualityDiffersFromDefault } from "@/lib/filter-summary";

export const LARGADA_DRAFT_KEY = "grid_largada_draft";

export type LargadaDraft = {
  filters: SearchFilters;
  step: number;
  intentDraft: string;
  companyLabels: Record<string, string>;
  cnaeLabels: Record<string, string>;
  fromSearch: string | null;
};

export type LargadaSource = "nova" | "fromSearch" | "draft" | "empty";

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function clampStep(step: number): number {
  if (step < 1) return 1;
  if (step > 3) return 3;
  return step;
}

export function mergeFilters(partial?: Partial<SearchFilters> | null): SearchFilters {
  return { ...DEFAULT_FILTERS, ...(partial ?? {}) };
}

export function resolveLargadaSource(input: {
  nova: boolean;
  fromSearch: string | null | undefined;
  hasDraft: boolean;
}): LargadaSource {
  if (input.nova) return "nova";
  if (input.fromSearch) return "fromSearch";
  if (input.hasDraft) return "draft";
  return "empty";
}

export function draftHasWork(draft: LargadaDraft | null | undefined): boolean {
  if (!draft) return false;
  if (draft.fromSearch) return true;
  if (clampStep(draft.step) > 1) return true;
  if (draft.intentDraft.trim().length > 0) return true;
  const f = mergeFilters(draft.filters);
  return (
    filterStepFilled(1, f) ||
    filterStepFilled(2, f) ||
    qualityDiffersFromDefault(f)
  );
}

function getSessionStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseDraft(raw: string): LargadaDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LargadaDraft>;
    return {
      filters: mergeFilters(parsed.filters),
      step: clampStep(typeof parsed.step === "number" ? parsed.step : 1),
      intentDraft: typeof parsed.intentDraft === "string" ? parsed.intentDraft : "",
      companyLabels:
        parsed.companyLabels && typeof parsed.companyLabels === "object"
          ? parsed.companyLabels
          : {},
      cnaeLabels:
        parsed.cnaeLabels && typeof parsed.cnaeLabels === "object"
          ? parsed.cnaeLabels
          : {},
      fromSearch:
        typeof parsed.fromSearch === "string" && parsed.fromSearch
          ? parsed.fromSearch
          : null,
    };
  } catch {
    return null;
  }
}

export function readDraft(storage: DraftStorage | null = getSessionStorage()): LargadaDraft | null {
  if (!storage) return null;
  const raw = storage.getItem(LARGADA_DRAFT_KEY);
  if (!raw) return null;
  return parseDraft(raw);
}

export function writeDraft(
  draft: LargadaDraft,
  storage: DraftStorage | null = getSessionStorage(),
): void {
  if (!storage) return;
  const payload: LargadaDraft = {
    filters: mergeFilters(draft.filters),
    step: clampStep(draft.step),
    intentDraft: draft.intentDraft,
    companyLabels: draft.companyLabels,
    cnaeLabels: draft.cnaeLabels,
    fromSearch: draft.fromSearch,
  };
  try {
    storage.setItem(LARGADA_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearDraft(storage: DraftStorage | null = getSessionStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(LARGADA_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
