import { mockRepo } from "@/lib/data/mock-repo";
import { supabaseRepo } from "@/lib/data/supabase-repo";
import type { GridRepo } from "@/lib/data/repo";

export type DataSource = "mock" | "supabase";

export function getDataSource(): DataSource {
  const raw = process.env.DATA_SOURCE ?? "mock";
  if (raw === "supabase" || raw === "postgres" || raw === "live") return "supabase";
  return "mock";
}

export function hasLiveDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Live RF when DATA_SOURCE is postgres/supabase/live and DATABASE_URL is set.
 * Requesting live without DATABASE_URL no longer falls back silently to mock.
 */
export function getRepo(): GridRepo {
  if (getDataSource() === "supabase") {
    if (!hasLiveDatabase()) {
      throw new Error(
        "DATA_SOURCE está em modo live, mas DATABASE_URL está ausente. " +
          "Defina DATABASE_URL ou use DATA_SOURCE=mock.",
      );
    }
    return supabaseRepo;
  }
  return mockRepo;
}

export { mockRepo };
