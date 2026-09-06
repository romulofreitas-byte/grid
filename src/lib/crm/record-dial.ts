import { digitsCnpj } from "@/lib/crm/bridge";
import { crmFetch } from "@/lib/crm/client";
import type { CrmDealCard, CrmEvent } from "@/lib/crm/types";

export type RecordCrmDialResult = {
  deal: CrmDealCard;
  event: CrmEvent | null;
  events?: CrmEvent[];
};

/** Same rule as the deal modal: complete an open `ligar`, else count a CNPJ call. */
export async function recordCrmDialAfterCall(
  deal: CrmDealCard,
): Promise<RecordCrmDialResult> {
  if (deal.next_activity?.kind === "ligar") {
    const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
      `/api/crm/deals/${deal.id}/complete`,
      { method: "POST" },
    );
    return { deal: res.deal, event: res.event };
  }
  const cnpj = deal.cnpj ? digitsCnpj(deal.cnpj) : "";
  if (cnpj.length !== 14) return { deal, event: null };
  const res = await fetch("/api/profile/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cnpj }),
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Não registrou a ligação.");
  const extra = await crmFetch<{ events: CrmEvent[] }>(
    `/api/crm/deals/${deal.id}/events`,
  );
  return { deal, event: null, events: extra.events };
}
