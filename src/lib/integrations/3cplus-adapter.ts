import type {
  IntegrationAdapter,
  OriginateInput,
  OutcomeEvent,
  PushResult,
} from "./adapter";
import type { LeadOutbound } from "./schema";
import {
  asRecord,
  brDigits,
  phoneToE164,
  pickCnpj,
  pickNumber,
  pickString,
  vendorFetch,
} from "./voip-dial";

const MAILING_CHUNK = 80;
const DEFAULT_LIST_WEIGHT = 1;

export type ThreeCPlusCampaign = { id: string; name: string };

export type ThreeCPlusMailing = {
  phone: string;
  identifier: string;
  data: Record<string, string>;
};

export function normalize3cplusHost(raw: string): string | null {
  const trimmed = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (!trimmed) return null;
  if (
    trimmed === "localhost" ||
    trimmed === "127.0.0.1" ||
    trimmed.endsWith(".internal") ||
    trimmed === "169.254.169.254"
  ) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

export function threeCplusApiBase(host: string): string {
  return `https://${host.replace(/\/$/, "")}/api/v1`;
}

function withToken(url: string, token: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("api_token", token);
  return parsed.toString();
}

function tokenError(status: number, body?: string): string {
  if (status === 401 || status === 403) {
    return "Token recusado. Confira o token de gestor no painel 3C Plus.";
  }
  const snippet = body?.replace(/\s+/g, " ").trim().slice(0, 160);
  return snippet
    ? `Não foi possível falar com o 3C Plus (${status}: ${snippet})`
    : `Não foi possível falar com o 3C Plus (${status})`;
}

function unwrapList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const rec = asRecord(json);
  if (!rec) return [];
  for (const key of ["data", "campaigns", "items", "results"]) {
    const value = rec[key];
    if (Array.isArray(value)) return value;
    const nested = asRecord(value);
    if (!nested) continue;
    for (const inner of ["data", "campaigns", "items"]) {
      const list = nested[inner];
      if (Array.isArray(list)) return list;
    }
  }
  return [];
}

function campaignFrom(raw: unknown): ThreeCPlusCampaign | null {
  const rec = asRecord(raw);
  const id = pickString(rec, ["id", "campaign_id", "campaignId"]);
  if (!id) return null;
  return {
    id,
    name: pickString(rec, ["name", "nome", "title"]) ?? `Campanha ${id}`,
  };
}

export function mailingFromLead(lead: LeadOutbound): ThreeCPlusMailing | null {
  const phone = lead.phones[0];
  if (!phone) return null;
  const digits = brDigits(phone.e164);
  if (digits.length < 8) return null;
  return {
    phone: digits,
    identifier: lead.cnpj,
    data: {
      name: lead.nome_fantasia || lead.razao_social,
      razao_social: lead.razao_social,
      cnpj: lead.cnpj,
      grid_score: String(lead.grid_score),
      municipio: lead.address.municipio,
      uf: lead.address.uf,
      dossier_url: lead.dossier_url,
      decisor: lead.decisor?.nome ?? "",
    },
  };
}

function hostFrom(ctx: { config: Record<string, unknown> }): string {
  const raw =
    pickString(asRecord(ctx.config), ["domain", "host", "api_host"]) ?? "";
  const host = normalize3cplusHost(raw);
  if (!host) throw new Error("Informe o domínio da conta 3C Plus");
  return host;
}

function campaignIdFrom(ctx: { config: Record<string, unknown> }): string {
  const id = pickString(asRecord(ctx.config), ["campaign_id"]) ?? "";
  if (!id) throw new Error("Informe a campanha do 3C Plus");
  return id;
}

function gestorToken(creds: Record<string, string>): string {
  const token = (creds.api_token ?? creds.token ?? "").trim();
  if (!token) throw new Error("Token de gestor da 3C Plus ausente");
  return token;
}

function agentToken(creds: Record<string, string>): string {
  const token = (creds.agent_token ?? creds.api_token ?? creds.token ?? "").trim();
  if (!token) throw new Error("Token de agente da 3C Plus ausente");
  return token;
}

function pickRecordId(json: unknown): string | undefined {
  const rec = asRecord(json);
  const direct = pickString(rec, ["id", "list_id", "listId"]);
  if (direct) return direct;
  const nested =
    asRecord(rec?.data) ??
    asRecord(rec?.mailingList) ??
    asRecord(rec?.list) ??
    asRecord(rec?.mailing_list);
  return pickString(nested, ["id", "list_id", "listId"]);
}

export async function list3cplusCampaigns(
  host: string,
  token: string,
): Promise<ThreeCPlusCampaign[]> {
  const res = await vendorFetch(withToken(`${threeCplusApiBase(host)}/campaigns`, token), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(tokenError(res.status, res.text));
  }
  return unwrapList(res.json)
    .map(campaignFrom)
    .filter((row): row is ThreeCPlusCampaign => Boolean(row));
}

export async function probe3cplus(
  host: string,
  token: string,
): Promise<
  | { ok: true; campaigns: ThreeCPlusCampaign[] }
  | { ok: false; error: string }
> {
  const normalized = normalize3cplusHost(host);
  if (!normalized) {
    return { ok: false, error: "Informe o domínio (ex.: empresa.3c.plus)" };
  }
  if (token.trim().length < 8) {
    return { ok: false, error: "Cole o token de gestor da 3C Plus" };
  }
  try {
    const campaigns = await list3cplusCampaigns(normalized, token.trim());
    return { ok: true, campaigns };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível falar com o 3C Plus",
    };
  }
}

function qualificationName(raw: unknown): string | undefined {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const rec = asRecord(raw);
  return pickString(rec, ["name", "nome", "label", "disposition", "qualification"]);
}

export function parse3cplusInbound(rawBody: string): OutcomeEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
  const root = asRecord(json);
  const mailing = asRecord(root?.mailing) ?? asRecord(root?.data);
  const mailingData = asRecord(mailing?.data) ?? asRecord(root?.data);
  const call = asRecord(root?.call);
  const identifier =
    pickString(root, ["identifier", "mailing_identifier"]) ??
    pickString(mailing, ["identifier"]) ??
    pickString(mailingData, ["identifier", "cnpj"]);
  const cnpj =
    pickCnpj(root) ??
    pickCnpj(mailingData) ??
    pickCnpj(mailing) ??
    (identifier && /^\d{14}$/.test(identifier.replace(/\D/g, ""))
      ? identifier.replace(/\D/g, "")
      : undefined);
  const phone =
    pickString(root, ["phone", "e164", "number", "telefone"]) ??
    pickString(mailing, ["phone", "number"]) ??
    pickString(call, ["number", "phone"]);
  const disposition =
    qualificationName(root?.qualification) ??
    qualificationName(root?.qualificacao) ??
    pickString(root, ["disposition", "status", "event", "type"]) ??
    pickString(call, ["disposition", "status"]);
  if (!disposition && !cnpj && !phone) return null;
  if (!cnpj && !phone) return null;
  return {
    cnpj,
    e164: phoneToE164(phone),
    disposition: disposition ?? "ligando",
    notes: pickString(root, ["notes", "note", "obs", "observation"]),
    durationSec: pickNumber(root, ["duration", "duration_sec", "durationSec"]) ??
      pickNumber(call, ["duration", "duration_sec"]),
    externalId:
      pickString(root, ["id", "call_id", "external_id"]) ??
      pickString(call, ["id"]),
  };
}

async function createMailingList(
  base: string,
  token: string,
  campaignId: string,
  name: string,
): Promise<string> {
  const body = new URLSearchParams();
  body.set("name", name);
  const res = await vendorFetch(
    withToken(`${base}/campaigns/${encodeURIComponent(campaignId)}/lists`, token),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(tokenError(res.status, res.text));
  }
  const id = pickRecordId(res.json);
  if (!id) throw new Error("3C Plus não devolveu o id da lista");
  return id;
}

async function pushMailingChunk(
  base: string,
  token: string,
  campaignId: string,
  listId: string,
  chunk: ThreeCPlusMailing[],
): Promise<void> {
  const res = await vendorFetch(
    withToken(
      `${base}/campaigns/${encodeURIComponent(campaignId)}/lists/${encodeURIComponent(listId)}/mailing.json`,
      token,
    ),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    },
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(tokenError(res.status, res.text));
  }
}

async function updateListWeight(
  base: string,
  token: string,
  campaignId: string,
  listId: string,
): Promise<void> {
  const body = new URLSearchParams();
  body.set("weight", String(DEFAULT_LIST_WEIGHT));
  await vendorFetch(
    withToken(
      `${base}/campaigns/${encodeURIComponent(campaignId)}/lists/${encodeURIComponent(listId)}/updateWeight`,
      token,
    ),
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
}

export function create3cplusAdapter(): IntegrationAdapter {
  return {
    kind: "dialer",
    auth: "api_key",
    async pushList(leads, ctx) {
      const creds = await ctx.decryptCredentials();
      const token = gestorToken(creds);
      const host = hostFrom(ctx);
      const campaignId = campaignIdFrom(ctx);
      const base = threeCplusApiBase(host);
      const errors: PushResult["errors"] = [];
      const mailings: ThreeCPlusMailing[] = [];
      for (const lead of leads) {
        const row = mailingFromLead(lead);
        if (!row) {
          errors.push({ cnpj: lead.cnpj, message: "Sem telefone exportável" });
          continue;
        }
        mailings.push(row);
      }
      if (mailings.length === 0) {
        return { accepted: 0, failed: errors.length, errors };
      }
      const searchName =
        pickString(asRecord(ctx.config), ["search_name"]) ??
        leads[0]?.search_name ??
        "Grid";
      const stamp = new Date().toISOString().slice(0, 10);
      const listName = `GRID ${searchName} ${stamp}`.slice(0, 80);
      const listId = await createMailingList(base, token, campaignId, listName);
      for (let i = 0; i < mailings.length; i += MAILING_CHUNK) {
        await pushMailingChunk(
          base,
          token,
          campaignId,
          listId,
          mailings.slice(i, i + MAILING_CHUNK),
        );
      }
      await updateListWeight(base, token, campaignId, listId);
      return {
        accepted: mailings.length,
        failed: errors.length,
        errors,
      };
    },
    async originate(call: OriginateInput, ctx) {
      const creds = await ctx.decryptCredentials();
      const token = agentToken(creds);
      const host = hostFrom(ctx);
      const phone = brDigits(call.toE164);
      if (phone.length < 8) throw new Error("Informe um telefone para discar");
      const body = new URLSearchParams();
      body.set("phone", phone);
      const res = await vendorFetch(
        withToken(`${threeCplusApiBase(host)}/agent/manual_call/dial`, token),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      if (!res.ok && res.status !== 204) {
        if (res.status === 400) {
          throw new Error(
            "Agente offline. Entre na campanha no 3C Plus antes de ligar.",
          );
        }
        throw new Error(tokenError(res.status, res.text));
      }
      const json = asRecord(res.json);
      const callRec = asRecord(json?.call);
      return {
        accepted: true,
        externalId:
          pickString(callRec, ["id"]) ?? pickString(json, ["id", "call_id"]),
      };
    },
    async parseInbound(_req, rawBody) {
      return parse3cplusInbound(rawBody);
    },
  };
}
