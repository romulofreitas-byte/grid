import { COPY } from "@/lib/copy";
import type { IntegrationConnectionPublic } from "./records";
import type { IntegrationKind, IntegrationProvider } from "./schema";
import { isNativeDialerProvider } from "./dialer-setup";
import { isNativeVoipProvider } from "./voip-setup";

const CALL_KIND_PRIORITY: IntegrationKind[] = ["voip", "dialer", "webhook"];

export type CallConnectionPick = Pick<
  IntegrationConnectionPublic,
  "id" | "kind" | "status" | "provider" | "display_name" | "catalog_id" | "caller_id"
>;

function canPlaceCall(provider: IntegrationProvider): boolean {
  return (
    provider === "webhook" ||
    isNativeVoipProvider(provider) ||
    isNativeDialerProvider(provider)
  );
}

/** VoIP click-to-call: CNPJ or a destination number is enough. */
export function canPlaceVoipCall(
  connection: CallConnectionPick | null | undefined,
  input: { cnpj?: string | null; to?: string | null },
): boolean {
  if (!connection) return false;
  const digits = (input.cnpj ?? "").replace(/\D/g, "");
  if (digits.length === 14) return true;
  return Boolean(input.to?.trim());
}

/** Active discador/VoIP/webhook for click-to-call. Never CRM. */
export function pickCallConnection(
  connections: readonly CallConnectionPick[],
): CallConnectionPick | null {
  const active = connections.filter(
    (c) => c.status === "active" && canPlaceCall(c.provider),
  );
  for (const kind of CALL_KIND_PRIORITY) {
    const ofKind = active.filter((c) => c.kind === kind);
    const native = ofKind.find((c) => isNativeVoipProvider(c.provider));
    if (native) return native;
    if (ofKind[0]) return ofKind[0];
  }
  return null;
}

export function callViaLabel(connection: CallConnectionPick): string {
  const name = connection.display_name?.trim();
  return name ? `Ligar via ${name}` : "Ligar";
}

export function testCallDestination(
  connection: {
    kind: IntegrationKind;
    caller_id?: string | null;
    provider?: IntegrationProvider | null;
    catalog_id?: string | null;
    config?: Record<string, unknown>;
  },
  to?: string | null,
): { ok: true; to: string } | { ok: false; error: string } {
  if (connection.kind === "crm") {
    return { ok: false, error: "CRM não disca" };
  }
  const fromConfig =
    typeof connection.config?.catalog_id === "string"
      ? connection.config.catalog_id
      : null;
  const catalog = connection.catalog_id ?? fromConfig ?? connection.provider;
  if (catalog === "api4com" && !to?.trim()) {
    return { ok: false, error: COPY.api4comTestHint };
  }
  const dest = (to ?? connection.caller_id ?? "").trim();
  if (!dest) return { ok: false, error: "Informe o ramal" };
  return { ok: true, to: dest };
}
