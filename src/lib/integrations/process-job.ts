import { getRepo } from "@/lib/data";
import { toE164 } from "@/lib/format";
import { normalizePhoneBR } from "@/lib/phone";
import type { ConnectionCtx } from "./adapter";
import { createWebhookAdapter } from "./webhook-adapter";
import { decryptJson } from "./crypto";
import { toLeadOutbound } from "./lead-outbound";
import { appOrigin } from "./records";
import type { IntegrationJobRecord } from "./records";
import type { IntegrationProvider } from "./schema";

/** Originate and inbound outcomes never debit. push_list is billed in the API via debitExport. */

function adapterFor(provider: IntegrationProvider) {
  if (provider === "webhook") return createWebhookAdapter();
  throw new Error(`adapter not implemented: ${provider}`);
}

function ctxFrom(
  job: IntegrationJobRecord,
  connection: {
    id: string;
    user_id: string;
    provider: IntegrationProvider;
    kind: "crm" | "dialer" | "voip" | "webhook";
    caller_id: string | null;
    config: Record<string, unknown>;
    credentials_ciphertext: string;
    credentials_nonce: string;
  },
): ConnectionCtx {
  return {
    connectionId: connection.id,
    userId: connection.user_id,
    provider: connection.provider,
    kind: connection.kind,
    config: {
      ...connection.config,
      search_id: job.search_id,
    },
    callerId: connection.caller_id,
    decryptCredentials: async () =>
      decryptJson(connection.credentials_ciphertext, connection.credentials_nonce),
  };
}

export async function processIntegrationJob(job: IntegrationJobRecord): Promise<void> {
  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(job.connection_id);
  if (!connection || connection.user_id !== job.user_id) {
    await repo.updateIntegrationJob(job.id, {
      status: "failed",
      last_error: "connection not found",
      finished_at: new Date().toISOString(),
    });
    return;
  }
  if (job.attempts > 3) {
    await repo.updateIntegrationJob(job.id, {
      status: "failed",
      last_error: "max attempts",
      finished_at: new Date().toISOString(),
    });
    return;
  }

  try {
    const adapter = adapterFor(connection.provider);
    const ctx = ctxFrom(job, connection);
    if (job.verb === "push_list") {
      if (!adapter.pushList) throw new Error("adapter cannot push_list");
      if (!job.search_id) throw new Error("search_id required");
      const search = await repo.getSearch(job.search_id);
      if (!search) throw new Error("search not found");
      const dossiers = await repo.getAllLeadsForExport(job.search_id);
      const origin = appOrigin();
      const leads = dossiers.map((d) =>
        toLeadOutbound(d, {
          searchId: search.id,
          searchName: search.nome,
          dossierUrl: `${origin}/lead/${d.establishment.cnpj}?searchId=${search.id}`,
          segmentSlugs: search.filtros.segmentIds,
        }),
      );
      const result = await adapter.pushList(leads, ctx);
      await repo.insertIntegrationEvent({
        user_id: job.user_id,
        connection_id: connection.id,
        job_id: job.id,
        direction: "outbound",
        event_type: "list.exported",
        cnpj: null,
        e164: null,
        external_id: null,
        disposition: null,
        lead_status: null,
        payload_summary: { accepted: result.accepted, failed: result.failed },
      });
      await repo.updateIntegrationJob(job.id, {
        status: "done",
        result: { accepted: result.accepted, failed: result.failed },
        finished_at: new Date().toISOString(),
      });
      return;
    }

    if (!adapter.originate) throw new Error("adapter cannot originate");
    if (job.payload?.test === true) {
      const to = String(job.payload.to ?? connection.caller_id ?? "").trim();
      if (!to) throw new Error("no ramal to test");
      const result = await adapter.originate(
        {
          toE164: to,
          from: connection.caller_id,
          cnpj: "",
          searchId: null,
        },
        ctx,
      );
      await repo.insertIntegrationEvent({
        user_id: job.user_id,
        connection_id: connection.id,
        job_id: job.id,
        direction: "outbound",
        event_type: "call.test",
        cnpj: null,
        e164: to,
        external_id: result.externalId ?? null,
        disposition: null,
        lead_status: null,
        payload_summary: { accepted: result.accepted, test: true },
      });
      await repo.updateIntegrationJob(job.id, {
        status: "done",
        result: { accepted: result.accepted, test: true },
        finished_at: new Date().toISOString(),
      });
      return;
    }
    const cnpj = String(job.payload?.cnpj ?? "");
    const dossier = await repo.getDossier(cnpj, job.search_id ?? undefined);
    if (!dossier) throw new Error("lead not found");
    const primary = dossier.contacts[0];
    const to =
      String(job.payload?.to ?? "") ||
      (primary
        ? normalizePhoneBR(`${primary.ddd ?? ""}${primary.telefone ?? ""}`, primary.ddd)
            ?.e164 ?? `+${toE164(primary.ddd, primary.telefone)}`
        : "");
    if (!to || to === "+null" || to === "+") throw new Error("no phone to dial");
    const result = await adapter.originate(
      {
        toE164: to.startsWith("+") ? to : `+${to.replace(/^\+/, "")}`,
        from: connection.caller_id,
        cnpj,
        searchId: job.search_id,
      },
      ctx,
    );
    await repo.insertIntegrationEvent({
      user_id: job.user_id,
      connection_id: connection.id,
      job_id: job.id,
      direction: "outbound",
      event_type: "call.originated",
      cnpj,
      e164: to,
      external_id: result.externalId ?? null,
      disposition: null,
      lead_status: "ligando",
      payload_summary: { accepted: result.accepted },
    });
    await repo.recordCallEvent(job.user_id, {
      cnpj,
      savedLeadId: dossier.savedLeadId,
      source: "dialer",
    });
    if (dossier.savedLeadId) {
      await repo.updateLead(dossier.savedLeadId, { status: "ligando" });
    }
    await repo.updateIntegrationJob(job.id, {
      status: "done",
      result: { accepted: result.accepted, externalId: result.externalId ?? null },
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await repo.updateIntegrationJob(job.id, {
      status: "failed",
      last_error: message.slice(0, 500),
      finished_at: new Date().toISOString(),
    });
  }
}

export async function drainIntegrationJobs(limit = 4): Promise<number> {
  const repo = getRepo();
  let n = 0;
  for (let i = 0; i < limit; i += 1) {
    const job = await repo.claimIntegrationJob();
    if (!job) break;
    await processIntegrationJob(job);
    n += 1;
  }
  return n;
}
