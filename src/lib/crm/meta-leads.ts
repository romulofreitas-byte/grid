import { createHmac, timingSafeEqual } from "node:crypto";
import { decryptJson, encryptJson } from "@/lib/integrations/crypto";
import {
  META_LEADGEN_FIELD,
  metaAppId,
  metaAppSecret,
  metaGraphGet,
  metaGraphGetAll,
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

type GraphPage = { id?: string; name?: string; access_token?: string };
type GraphBusiness = { id?: string };

const PAGE_FIELDS = "id,name,access_token";

async function graphListOrEmpty<T>(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T[]> {
  try {
    return await metaGraphGetAll<T>(path, token, params);
  } catch (err) {
    console.warn("meta_graph_list_failed", path, err);
    return [];
  }
}

function ingestPages(
  byId: Map<string, { id: string; name: string; access_token?: string }>,
  rows: GraphPage[],
) {
  for (const row of rows) {
    if (!row.id) continue;
    const prev = byId.get(row.id);
    byId.set(row.id, {
      id: row.id,
      name: row.name?.trim() || prev?.name || row.id,
      access_token: row.access_token || prev?.access_token,
    });
  }
}

async function pageTokenFallback(
  pageId: string,
  userToken: string,
): Promise<{ name?: string; access_token?: string } | null> {
  try {
    return await metaGraphGet<GraphPage>(`/${pageId}`, userToken, {
      fields: PAGE_FIELDS,
    });
  } catch (err) {
    console.warn("meta_page_token_failed", pageId, err);
    return null;
  }
}

/**
 * Pages the user can use for Instant Forms.
 * `/me/accounts` hides Business Manager Pages without `business_management`
 * (Graph v17+). Also tries assigned Pages and BM owned/client Pages.
 */
export async function listMetaPages(userToken: string): Promise<MetaPage[]> {
  const byId = new Map<string, { id: string; name: string; access_token?: string }>();
  const [accounts, assigned] = await Promise.all([
    metaGraphGetAll<GraphPage>("/me/accounts", userToken, { fields: PAGE_FIELDS }),
    graphListOrEmpty<GraphPage>("/me/assigned_pages", userToken, {
      fields: PAGE_FIELDS,
    }),
  ]);
  ingestPages(byId, accounts);
  ingestPages(byId, assigned);

  const businesses = await graphListOrEmpty<GraphBusiness>("/me/businesses", userToken, {
    fields: "id",
  });
  for (const biz of businesses.slice(0, 20)) {
    if (!biz.id) continue;
    const [owned, client] = await Promise.all([
      graphListOrEmpty<GraphPage>(`/${biz.id}/owned_pages`, userToken, {
        fields: PAGE_FIELDS,
      }),
      graphListOrEmpty<GraphPage>(`/${biz.id}/client_pages`, userToken, {
        fields: PAGE_FIELDS,
      }),
    ]);
    ingestPages(byId, owned);
    ingestPages(byId, client);
  }

  const usable: MetaPage[] = [];
  let skipped = 0;
  for (const page of byId.values()) {
    let token = page.access_token;
    let name = page.name;
    if (!token) {
      const detail = await pageTokenFallback(page.id, userToken);
      token = detail?.access_token;
      if (detail?.name?.trim()) name = detail.name.trim();
    }
    if (token) {
      usable.push({ id: page.id, name, access_token: token });
    } else {
      skipped += 1;
      console.warn("meta_page_skipped_no_token", page.id, name);
    }
  }
  console.info("meta_pages_listed", {
    found: byId.size,
    usable: usable.length,
    skipped,
  });
  return usable;
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
