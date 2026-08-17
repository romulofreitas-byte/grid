import type {
  IntegrationKind,
  IntegrationProvider,
} from "./schema";

export type IntegrationConnectionStatus =
  | "pending"
  | "active"
  | "error"
  | "revoked";

export type IntegrationJobStatus = "pending" | "running" | "done" | "failed";

export type IntegrationConnectionRecord = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  kind: IntegrationKind;
  display_name: string | null;
  status: IntegrationConnectionStatus;
  credentials_ciphertext: string;
  credentials_nonce: string;
  oauth_expires_at: string | null;
  caller_id: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IntegrationJobRecord = {
  id: number;
  user_id: string;
  connection_id: string;
  search_id: string | null;
  verb: "push_list" | "originate_call";
  provider: IntegrationProvider;
  status: IntegrationJobStatus;
  attempts: number;
  last_error: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  locked_at: string | null;
  created_at: string;
  finished_at: string | null;
};

export type IntegrationEventRecord = {
  id: string;
  user_id: string;
  connection_id: string | null;
  job_id: number | null;
  direction: "inbound" | "outbound";
  event_type: string;
  cnpj: string | null;
  e164: string | null;
  external_id: string | null;
  disposition: string | null;
  lead_status: string | null;
  payload_summary: Record<string, unknown>;
  created_at: string;
};

export type IntegrationConnectionPublic = {
  id: string;
  provider: IntegrationProvider;
  kind: IntegrationKind;
  display_name: string | null;
  status: IntegrationConnectionStatus;
  caller_id: string | null;
  webhook_url: string | null;
  inbound_url: string;
  catalog_id: string | null;
  has_credentials: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedLeadRef = {
  id: string;
  cnpj: string;
  search_id: string;
};

export function appOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function inboundWebhookPath(connectionId: string): string {
  return `/api/webhooks/inbound/${connectionId}`;
}

export function toPublicConnection(
  row: IntegrationConnectionRecord,
  origin: string = appOrigin(),
): IntegrationConnectionPublic {
  const webhookUrl =
    typeof row.config.webhook_url === "string" ? row.config.webhook_url : null;
  const catalogId =
    typeof row.config.catalog_id === "string" ? row.config.catalog_id : null;
  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    display_name: row.display_name,
    status: row.status,
    caller_id: row.caller_id,
    webhook_url: webhookUrl,
    inbound_url: `${origin}${inboundWebhookPath(row.id)}`,
    catalog_id: catalogId,
    has_credentials: Boolean(row.credentials_ciphertext && row.credentials_nonce),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
