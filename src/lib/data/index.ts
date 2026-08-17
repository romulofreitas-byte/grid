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

export function getRepo(): GridRepo {
  if (getDataSource() === "supabase" && hasLiveDatabase()) {
    return supabaseRepo;
  }
  return mockRepo;
}

export { mockRepo };
