import { usesMockAuth } from "@/lib/auth/mock";
import { getDataSource, hasLiveDatabase } from "@/lib/data/index";

export function isProdDeploy(): boolean {
  return (
    process.env.GRID_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export type EnvIssue = { level: "error" | "warn"; message: string };

export function collectLaunchEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];

  if (usesMockAuth()) {
    issues.push({
      level: isProdDeploy() ? "error" : "warn",
      message:
        "Auth mock ativo (GRID_MOCK_AUTH ou Supabase keys ausentes) — inaceitável em produção.",
    });
  }

  const source = getDataSource();
  if (source !== "supabase" || !hasLiveDatabase()) {
    issues.push({
      level: isProdDeploy() ? "error" : "warn",
      message: `DATA_SOURCE=${process.env.DATA_SOURCE ?? "mock"} — use postgres em produção.`,
    });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    issues.push({
      level: "error",
      message: "DATABASE_URL ausente.",
    });
  }

  if (process.env.BILLING_STORE === "memory") {
    issues.push({
      level: isProdDeploy() ? "error" : "warn",
      message: "BILLING_STORE=memory — créditos não persistem.",
    });
  }

  if (isProdDeploy() && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    issues.push({ level: "error", message: "NEXT_PUBLIC_SITE_URL ausente." });
  }

  if (isProdDeploy() && !process.env.GRID_ADMIN_EMAILS?.trim()) {
    issues.push({
      level: "error",
      message: "GRID_ADMIN_EMAILS ausente — ninguém acessa /admin.",
    });
  }

  if (isProdDeploy() && !process.env.INTEGRATION_KMS_KEY?.trim()) {
    issues.push({
      level: "error",
      message: "INTEGRATION_KMS_KEY ausente — credenciais de integração inseguras.",
    });
  }

  if (isProdDeploy() && !process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    issues.push({
      level: "warn",
      message: "Upstash Redis ausente — rate limit e count cache só in-memory.",
    });
  }

  return issues;
}

export function assertWorkerEnv(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Worker requires DATABASE_URL");
  }
  const source = process.env.DATA_SOURCE ?? "mock";
  if (!["postgres", "supabase", "live"].includes(source)) {
    throw new Error("Worker requires DATA_SOURCE=postgres");
  }
}
