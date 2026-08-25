import type { GridRepo } from "@/lib/data/repo";

export type CatchUpLockResult = "ok" | "busy" | "cooldown";

export type CatchUpRunResult = {
  created: number;
  skipped: number;
  hasMore: boolean;
};

export type CatchUpCandidate = {
  searchId: string;
  cnpj: string;
};

export type CatchUpTaskMode = "reconcile" | "once";

export type CatchUpTask = {
  id: string;
  mode: CatchUpTaskMode;
  run: (userId: string, repo: GridRepo) => Promise<CatchUpRunResult>;
};
