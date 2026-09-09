"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IntegracoesCategoryChips } from "@/components/integracoes/IntegracoesCategoryChips";
import {
  MetaConnectGuide,
  type MetaOAuthFlash,
} from "@/components/integracoes/MetaConnectGuide";
import { COPY } from "@/lib/copy";
import { pagarHref } from "@/lib/billing/href";
import { isSkuOnSale, planHasFeature } from "@/lib/billing/catalog";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { useBillingMe } from "@/hooks/useBillingMe";

type MetaPagesResponse = {
  pages: CrmMetaConnection[];
  configured?: boolean;
};

export function IntegracoesHub() {
  const billing = useBillingMe();
  const [flash, setFlash] = useState<MetaOAuthFlash | null>(null);
  const automations = planHasFeature(
    billing.data?.balance.plano,
    "automations",
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (meta === "ok" || meta === "denied" || meta === "error" || meta === "nopages") {
      setFlash(meta);
    }
    if (meta) {
      params.delete("meta");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const pagesQuery = useQuery({
    queryKey: ["crm-meta-pages"],
    queryFn: async () => {
      const res = await fetch("/api/automacoes/meta/pages");
      if (!res.ok) throw new Error("pages");
      return (await res.json()) as MetaPagesResponse;
    },
    enabled: Boolean(billing.data) && automations,
  });

  const proHref = isSkuOnSale("piloto_pro")
    ? pagarHref("piloto_pro", "/integracoes")
    : "/planos#piloto-pro";

  const locked = !billing.isLoading && !automations;
  const loading =
    billing.isLoading || (automations && pagesQuery.isLoading && !pagesQuery.data);

  return (
    <div className="mt-3 space-y-4">
      <IntegracoesCategoryChips current="conectar" />
      <p className="max-w-3xl text-sm text-podium-muted">{COPY.integracoesLead}</p>
      <MetaConnectGuide
        pages={pagesQuery.data?.pages ?? []}
        configured={
          pagesQuery.isSuccess && pagesQuery.data.configured !== false
        }
        loading={loading}
        pagesError={pagesQuery.isError}
        locked={locked}
        proHref={proHref}
        flash={flash}
        onRetryPages={() => {
          void pagesQuery.refetch();
        }}
      />
    </div>
  );
}
