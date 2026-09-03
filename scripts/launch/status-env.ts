#!/usr/bin/env tsx
import "../../src/lib/load-env";

const KEYS = [
  "DATA_SOURCE",
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "GRID_MOCK_AUTH",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "GRID_ENV",
  "GRID_ADMIN_EMAILS",
  "GRID_OPS_EMAIL",
  "GRID_OPS_PASSWORD",
  "GRID_OPS_SECRET",
  "INTEGRATION_KMS_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "BILLING_STORE",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SERPER_API_KEY",
] as const;

for (const key of KEYS) {
  const raw = process.env[key];
  const set = Boolean(raw?.trim());
  const hint =
    key === "GRID_MOCK_AUTH" && raw === "1"
      ? " (mock ON — turn off for prod)"
      : key === "BILLING_STORE" && raw === "memory"
        ? " (memory — credits will not persist)"
        : "";
  console.log(`${set ? "SET " : "----"}  ${key}${hint}`);
}
