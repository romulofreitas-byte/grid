import { createHash, timingSafeEqual } from "crypto";
import { isProdDeploy } from "@/lib/env/deploy";

export function requireBillingWebhookSecret(
  envName: string,
  value: string | undefined,
): void {
  if (!isProdDeploy()) return;
  if (!value?.trim()) {
    throw new Error(`${envName} obrigatório em produção`);
  }
}

export function webhookSecretsEqual(expected: string, received: string): boolean {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(received).digest();
  return timingSafeEqual(a, b);
}

/** Asaas sends `asaas-access-token`; some proxies alter casing or aliases. */
export function asaasAccessToken(req: Request): string {
  const names = [
    "asaas-access-token",
    "access_token",
    "x-asaas-token",
    "authorization",
  ];
  for (const name of names) {
    const raw = req.headers.get(name)?.trim() ?? "";
    if (!raw) continue;
    if (name === "authorization" && raw.toLowerCase().startsWith("bearer ")) {
      return raw.slice(7).trim();
    }
    return raw;
  }
  return "";
}
