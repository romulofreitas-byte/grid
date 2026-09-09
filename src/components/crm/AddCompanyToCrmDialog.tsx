"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaywall } from "@/components/PaywallDialog";
import {
  CrmAddDealDialog,
  type CrmAddDealInput,
} from "@/components/crm/CrmAddDealDialog";
import { isBillingGateError, throwIfBillingGate } from "@/lib/billing/paywall";
import { crmFetch } from "@/lib/crm/client";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import type { CompanySearchHit } from "@/lib/types";

export function AddCompanyToCrmDialog({
  company,
  onClose,
  onCreated,
}: {
  company: CompanySearchHit;
  onClose: () => void;
  onCreated: (deal: { id: string; pipelineId: string }) => void;
}) {
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const pipelinesQuery = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/crm/pipelines");
      const json = (await res.json()) as {
        pipelines?: CrmPipelineSummary[];
        error?: string;
      };
      throwIfBillingGate(res.status, json, openPaywall, "crm");
      if (!res.ok) throw new Error(json.error ?? "Não carregou o CRM");
      return json.pipelines ?? [];
    },
  });

  useEffect(() => {
    if (isBillingGateError(pipelinesQuery.error)) onClose();
  }, [onClose, pipelinesQuery.error]);

  if (isBillingGateError(pipelinesQuery.error)) return null;

  if (pipelinesQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <button
          type="button"
          aria-label="Fechar"
          className="absolute inset-0 bg-black/45"
          onClick={onClose}
        />
        <p className="relative rounded-lg border border-white/10 bg-podium-panel px-4 py-3 text-sm text-podium-muted">
          Abrindo o CRM…
        </p>
      </div>
    );
  }

  if (pipelinesQuery.isError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <button
          type="button"
          aria-label="Fechar"
          className="absolute inset-0 bg-black/45"
          onClick={onClose}
        />
        <p className="relative text-sm text-podium-yellow">
          Não foi possível abrir o CRM. Tente de novo.
        </p>
      </div>
    );
  }

  const pipelines = pipelinesQuery.data ?? [];

  async function handleCreate(input: CrmAddDealInput) {
    const res = await crmFetch<{ deal: { id: string; pipeline_id: string } }>(
      `/api/crm/pipelines/${input.pipelineId}/deals`,
      {
        method: "POST",
        body: JSON.stringify({
          company_name: input.company_name,
          contact_name: input.contact_name,
          secretaries: input.secretaries,
          people: input.people,
          phones: input.phones,
          cnpj: input.cnpj,
          meta: input.meta,
          stage_id: input.stage_id,
        }),
      },
    );
    void qc.invalidateQueries({ queryKey: ["empresas-contexto"] });
    onCreated({ id: res.deal.id, pipelineId: res.deal.pipeline_id });
  }

  return (
    <CrmAddDealDialog
      initialHit={company}
      pipelines={pipelines}
      currentPipelineId=""
      currentStages={[]}
      currentDeals={[]}
      onClose={onClose}
      onPipelineCreated={() => undefined}
      onOpenExisting={(dealId, pipelineId) => {
        onCreated({ id: dealId, pipelineId });
      }}
      onCreate={handleCreate}
    />
  );
}

