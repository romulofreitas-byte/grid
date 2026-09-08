import { createHmac, timingSafeEqual } from "node:crypto";
import { decryptJson, encryptJson } from "@/lib/integrations/crypto";
import {
  META_LEADGEN_FIELD,
  metaAppId,
  metaAppSecret,
  metaGraphGet,
  metaGraphPost,
} from "@/lib/crm/meta-api";

export {
  metaConfigured,
  metaOAuthUrl,
  metaWebhookVerifyToken,
} from "@/lib/crm/meta-api";

export function signMetaOAuthState(userId: string): string {
  const body = Buffer.from(JSON.stringify({ userId, t: Date.now() })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", metaAppSecret() || "dev-meta").update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseMetaOAuthState(state: string): { userId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", metaAppSecret() || "dev-meta")
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: string;
    };
    return parsed.userId ? { userId: parsed.userId } : null;
  } catch {
    return null;
  }
}

export type MetaField = { name: string; values: string[] };

export type MetaLead = {
  id: string;
  form_id?: string;
  field_data?: MetaField[];
};

export function mapMetaLeadToInbound(lead: MetaLead): Record<string, unknown> {
  const values = new Map<string, string>();
  for (const field of lead.field_data ?? []) {
    const value = field.values?.[0]?.trim();
    if (field.name && value) values.set(field.name.toLowerCase(), value);
  }
  const name =
    values.get("full_name") ??
    [values.get("first_name"), values.get("last_name")].filter(Boolean).join(" ").trim();
  const answers: Record<string, string> = {};
  const reserved = new Set([
    "full_name",
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "phone",
    "company_name",
    "company",
  ]);
  for (const [key, value] of values) {
    if (!reserved.has(key)) answers[key] = value;
  }
  return {
    kind: "person",
    name: name || undefined,
    email: values.get("email"),
    phone: values.get("phone_number") ?? values.get("phone"),
    company: values.get("company_name") ?? values.get("company"),
    answers,
  };
}

export type MetaLeadgenChange = {
  pageId: string;
  formId: string | null;
  leadgenId: string;
};

export function parseLeadgenPayload(body: unknown): MetaLeadgenChange[] {
  if (!body || typeof body !== "object") return [];
  const rec = body as { entry?: unknown[] };
  const out: MetaLeadgenChange[] = [];
  for (const entry of rec.entry ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const page = entry as { id?: string; changes?: unknown[] };
    for (const change of page.changes ?? []) {
      if (!change || typeof change !== "object") continue;
      const item = change as {
        field?: string;
        value?: { leadgen_id?: string; form_id?: string; page_id?: string };
      };
      if (item.field !== META_LEADGEN_FIELD || !item.value?.leadgen_id) continue;
      out.push({
        pageId: item.value.page_id ?? page.id ?? "",
        formId: item.value.form_id ?? null,
        leadgenId: item.value.leadgen_id,
      });
    }
  }
  return out.filter((row) => row.pageId && row.leadgenId);
}

export function encryptPageToken(pageAccessToken: string): {
  ciphertext: string;
  nonce: string;
} {
  return encryptJson({ page_access_token: pageAccessToken });
}

export function decryptPageToken(ciphertext: string, nonce: string): string {
  return decryptJson(ciphertext, nonce).page_access_token ?? "";
}

export async function exchangeMetaCode(code: string, redirectUri: string): Promise<string> {
  const json = await metaGraphGet<{ access_token: string }>("/oauth/access_token", "", {
    client_id: metaAppId(),
    client_secret: metaAppSecret(),
    redirect_uri: redirectUri,
    code,
  });
  return json.access_token;
}

export type MetaPage = { id: string; name: string; access_token: string };

export async function listMetaPages(userToken: string): Promise<MetaPage[]> {
  const json = await metaGraphGet<{ data?: MetaPage[] }>("/me/accounts", userToken, {
    fields: "id,name,access_token",
  });
  return (json.data ?? []).filter((page) => page.id && page.access_token);
}

export async function subscribePageToLeadgen(pageToken: string, pageId: string): Promise<void> {
  await metaGraphPost(`/${pageId}/subscribed_apps`, pageToken, {
    subscribed_fields: META_LEADGEN_FIELD,
  });
}

export async function listMetaForms(
  pageToken: string,
  pageId: string,
): Promise<Array<{ id: string; name: string }>> {
  const json = await metaGraphGet<{ data?: Array<{ id: string; name: string }> }>(
    `/${pageId}/leadgen_forms`,
    pageToken,
    { fields: "id,name", limit: "50" },
  );
  return json.data ?? [];
}

export async function fetchMetaLead(pageToken: string, leadgenId: string): Promise<MetaLead> {
  return metaGraphGet<MetaLead>(`/${leadgenId}`, pageToken, {
    fields: "id,form_id,field_data",
  });
}
