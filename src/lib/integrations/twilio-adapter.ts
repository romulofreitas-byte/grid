import type { IntegrationAdapter, OriginateInput, OutcomeEvent } from "./adapter";
import {
  asRecord,
  phoneToE164,
  pickString,
  toDialE164,
  vendorFetch,
  vendorHttpError,
  xmlEscape,
} from "./voip-dial";

function basicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`, "utf8").toString("base64")}`;
}

export async function probeTwilio(
  accountSid: string,
  authToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await vendorFetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
    { headers: { Authorization: basicAuth(accountSid, authToken) } },
  );
  if (!res.ok) {
    return { ok: false, error: vendorHttpError(res.status, "Token recusado") };
  }
  return { ok: true };
}

function credsFrom(record: Record<string, string>): {
  sid: string;
  token: string;
} {
  const sid = record.account_sid?.trim() ?? "";
  const token = record.auth_token?.trim() ?? "";
  if (!sid || !token) throw new Error("Account SID e Auth Token são obrigatórios");
  return { sid, token };
}

function fromNumber(ctx: { config: Record<string, unknown>; callerId?: string | null }): string {
  const from =
    (typeof ctx.config.from_number === "string" ? ctx.config.from_number : "") ||
    "";
  const e164 = toDialE164(from);
  if (!e164) throw new Error("Informe o número Twilio (From) em E.164");
  return e164;
}

function twimlDial(from: string, customer: string): string {
  return `<Response><Dial callerId="${xmlEscape(from)}">${xmlEscape(customer)}</Dial></Response>`;
}

function twimlSay(): string {
  return `<Response><Say language="pt-BR">GRID conectado.</Say></Response>`;
}

export function parseTwilioInbound(
  req: Request,
  rawBody: string,
): OutcomeEvent | null {
  const contentType = req.headers.get("content-type") ?? "";
  let fields: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    try {
      const json = asRecord(JSON.parse(rawBody));
      if (json) {
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string") fields[key] = value;
        }
      }
    } catch {
      return null;
    }
  } else {
    const params = new URLSearchParams(rawBody);
    fields = Object.fromEntries(params.entries());
  }
  const status =
    fields.DialCallStatus || fields.CallStatus || fields.CallStatusCallbackEvent || "ligando";
  const to = fields.DialCallTo || fields.To || fields.Called;
  return {
    e164: phoneToE164(to),
    disposition: status,
    durationSec: fields.CallDuration ? Number(fields.CallDuration) : undefined,
    externalId: fields.CallSid || fields.ParentCallSid,
  };
}

export function createTwilioAdapter(): IntegrationAdapter {
  return {
    kind: "voip",
    auth: "api_key",
    async originate(call: OriginateInput, ctx) {
      const creds = credsFrom(await ctx.decryptCredentials());
      const from = fromNumber(ctx);
      const agent = toDialE164(call.from ?? ctx.callerId ?? "");
      if (!agent) throw new Error("Informe seu número com DDD para a Twilio tocar");
      const isTest = !call.cnpj;
      const twiml = isTest ? twimlSay() : twimlDial(from, call.toE164);
      const inbound =
        typeof ctx.config.inbound_url === "string" ? ctx.config.inbound_url : "";
      const body = new URLSearchParams({
        To: agent,
        From: from,
        Twiml: twiml,
      });
      if (inbound) {
        body.set("StatusCallback", inbound);
        body.set("StatusCallbackMethod", "POST");
        for (const event of ["initiated", "ringing", "answered", "completed"]) {
          body.append("StatusCallbackEvent", event);
        }
      }
      const res = await vendorFetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.sid)}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: basicAuth(creds.sid, creds.token),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      if (!res.ok) {
        throw new Error(
          vendorHttpError(res.status, "Não foi possível ligar", res.text),
        );
      }
      const json = asRecord(res.json);
      return {
        accepted: true,
        externalId: pickString(json, ["sid"]),
      };
    },
    async parseInbound(req, rawBody) {
      return parseTwilioInbound(req, rawBody);
    },
  };
}
