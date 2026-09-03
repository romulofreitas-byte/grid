import { usesMockAuth } from "@/lib/auth/mock";
import { getDataSource, hasLiveDatabase } from "@/lib/data/index";
import {
  asaasConfigured,
  stripeConfigured,
} from "@/lib/billing/providers/types";

export function isProdDeploy(): boolean {
  return (
    process.env.GRID_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

/** Runtime production only — skips `next build` (NODE_ENV=production during compile). */
export function isRuntimeProduction(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return (
    process.env.GRID_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export type EnvIssue = { level: "error" | "warn"; message: string };

export function collectLaunchEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const strict = isRuntimeProduction() || isProdDeploy();

  if (usesMockAuth()) {
    issues.push({
      level: isRuntimeProduction() ? "error" : "warn",
      message:
        "Auth mock ativo (GRID_MOCK_AUTH ou Supabase keys ausentes) — inaceitável em produção.",
    });
  }

  const source = getDataSource();
  if (source !== "supabase" || !hasLiveDatabase()) {
    issues.push({
      level: isRuntimeProduction() ? "error" : "warn",
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
      level: isRuntimeProduction() ? "error" : "warn",
      message: "BILLING_STORE=memory — créditos não persistem.",
    });
  }

  if (isRuntimeProduction() && !asaasConfigured() && !stripeConfigured()) {
    issues.push({
      level: "error",
      message:
        "Nenhum PSP configurado (Asaas/Stripe) — checkout cairia no provider mock.",
    });
  }

  if (isRuntimeProduction() && process.env.MOCK_PREVIEW_SEALS === "1") {
    issues.push({
      level: "error",
      message: "MOCK_PREVIEW_SEALS=1 — selos sorteados não podem ir a produção.",
    });
  }

  if (isRuntimeProduction() && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    issues.push({ level: "error", message: "NEXT_PUBLIC_SITE_URL ausente." });
  }

  if (isRuntimeProduction() && !process.env.GRID_ADMIN_EMAILS?.trim()) {
    issues.push({
      level: "error",
      message: "GRID_ADMIN_EMAILS ausente — ninguém acessa /admin.",
    });
  }

  if (isRuntimeProduction() && !process.env.GRID_OPS_PASSWORD?.trim()) {
    issues.push({
      level: "warn",
      message: "GRID_OPS_PASSWORD ausente — /ops desligado.",
    });
  } else if (
    isRuntimeProduction() &&
    process.env.GRID_OPS_PASSWORD?.trim() &&
    !process.env.GRID_OPS_SECRET?.trim()
  ) {
    issues.push({
      level: "warn",
      message:
        "GRID_OPS_SECRET ausente — cookie do /ops assinado com a senha.",
    });
  }

  if (isRuntimeProduction() && !process.env.INTEGRATION_KMS_KEY?.trim()) {
    issues.push({
      level: "error",
      message: "INTEGRATION_KMS_KEY ausente — credenciais de integração inseguras.",
    });
  }

  if (isRuntimeProduction() && !process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    issues.push({
      level: "error",
      message:
        "Upstash Redis ausente — count cache, rate limit e fila de contagem exigem Redis em produção.",
    });
  }

  if (strict && !process.env.SERPER_API_KEY?.trim()) {
    issues.push({
      level: "warn",
      message:
        "SERPER_API_KEY ausente — enriquecimento de domínio fica limitado ao e-mail da RF.",
    });
  }

  return issues;
}

/** Hard-fail boot in production when mock/auth/billing would silently lie. */
export function assertProdEnv(): void {
  if (!isRuntimeProduction()) return;
  const errors = collectLaunchEnvIssues().filter((i) => i.level === "error");
  if (!errors.length) return;
  const detail = errors.map((e) => e.message).join("\n - ");
  throw new Error(
    `GRID produção bloqueada — corrija o env antes de subir:\n - ${detail}`,
  );
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
