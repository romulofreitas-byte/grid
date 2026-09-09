import { createHmac, timingSafeEqual } from "node:crypto";

/** Graph version used by OAuth, Page tokens and leadgen. */
export const META_GRAPH_VERSION = "v21.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

/**
 * Permissions the Meta app must request (and App Review must approve)
 * for Instant Form → CRM.
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "leads_retrieval",
  "pages_read_engagement",
] as const;

export const META_OAUTH_CALLBACK_PATH = "/api/automacoes/meta/callback";
/** Misspelling already saved in the Meta app OAuth allowlist. */
export const META_OAUTH_CALLBACK_ALIAS_PATH = "/api/automacaoes/meta/callback";
export const META_OAUTH_RETURN_PATH = "/integracoes";
export const META_LEADGEN_WEBHOOK_PATH = "/api/webhooks/meta/leads";
export const META_LEADGEN_FIELD = "leadgen";

const META_OAUTH_CALLBACK_PATHS = new Set([
  META_OAUTH_CALLBACK_PATH,
  META_OAUTH_CALLBACK_ALIAS_PATH,
]);

export function isMetaOAuthCallbackPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return META_OAUTH_CALLBACK_PATHS.has(path);
}

export function metaAppId(): string {
  return process.env.META_APP_ID?.trim() ?? "";
}

export function metaAppSecret(): string {
  return process.env.META_APP_SECRET?.trim() ?? "";
}

export function metaWebhookVerifyToken(): string {
  return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
}

/** OAuth + Graph calls. Webhook subscribe still needs META_WEBHOOK_VERIFY_TOKEN. */
export function metaConfigured(): boolean {
  return Boolean(metaAppId() && metaAppSecret());
}

export function metaWebhookConfigured(): boolean {
  return metaConfigured() && Boolean(metaWebhookVerifyToken());
}

export function metaJoinUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function metaOAuthRedirectUri(
  origin: string,
  pathname: string = META_OAUTH_CALLBACK_PATH,
): string {
  const path = isMetaOAuthCallbackPath(pathname)
    ? pathname.replace(/\/+$/, "")
    : META_OAUTH_CALLBACK_PATH;
  return metaJoinUrl(origin, path);
}

export function metaLeadgenWebhookUrl(origin: string): string {
  return metaJoinUrl(origin, META_LEADGEN_WEBHOOK_PATH);
}

export function metaOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: metaAppId(),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: META_OAUTH_SCOPES.join(","),
  });
  return `${META_OAUTH_DIALOG}?${params.toString()}`;
}

/** HMAC of the raw webhook body with the app secret (`X-Hub-Signature-256`). */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  const secret = metaAppSecret();
  const match = /^sha256=([0-9a-fA-F]+)$/.exec((signatureHeader ?? "").trim());
  if (!secret || !match) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = match[1].toLowerCase();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function metaGraphGet<T>(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  if (token) url.searchParams.set("access_token", token);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return readGraphJson<T>(await fetch(url));
}

export async function metaGraphPost<T>(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  const body = new URLSearchParams({ access_token: token, ...params });
  return readGraphJson<T>(
    await fetch(url, { method: "POST", body }),
  );
}

async function readGraphJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Meta Graph ${res.status}`);
  }
  return json;
}
