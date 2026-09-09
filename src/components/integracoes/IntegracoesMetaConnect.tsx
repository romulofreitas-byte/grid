"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IntegracoesFocusHeader } from "@/components/integracoes/IntegracoesFocusHeader";
import {
  MetaConnectGuide,
  type MetaOAuthFlash,
} from "@/components/integracoes/MetaConnectGuide";
import { COPY } from "@/lib/copy";
import { pagarHref } from "@/lib/billing/href";
import { isSkuOnSale, planHasFeature } from "@/lib/billing/catalog";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { getHubItem } from "@/lib/integrations/hub";
import { useBillingMe } from "@/hooks/useBillingMe";

type MetaPagesResponse = {
  pages: CrmMetaConnection[];
  pending?: CrmMetaConnection[];
  configured?: boolean;
};

const EMPTY_PAGES: CrmMetaConnection[] = [];

export function IntegracoesMetaConnect() {
  const billing = useBillingMe();
  const [flash, setFlash] = useState<MetaOAuthFlash | null>(null);
  const automations = planHasFeature(
    billing.data?.balance.plano,
    "automations",
  );
  const meta = getHubItem("meta");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("meta");
    if (value === "ok" || value === "denied" || value === "error" || value === "nopages") {
      setFlash(value);
    }
    if (value) {
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
    ? pagarHref("piloto_pro", "/integracoes/meta")
    : "/planos#piloto-pro";

  const locked = !billing.isLoading && !automations;
  const loading =
    billing.isLoading || (automations && pagesQuery.isLoading && !pagesQuery.data);
  const pages = pagesQuery.data?.pages ?? EMPTY_PAGES;
  const status =
    pages.length === 0
      ? COPY.integracoesStatusNone
      : pages.length === 1
        ? COPY.integracoesStatusPagesOne
        : COPY.integracoesStatusPagesMany.replace("{n}", String(pages.length));

  return (
    <div className="mt-3 space-y-4">
      <IntegracoesFocusHeader
        item={meta}
        title={COPY.integracoesFacebookTitle}
        status={status}
      />
      <MetaConnectGuide
        pages={pages}
        pending={pagesQuery.data?.pending ?? EMPTY_PAGES}
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
