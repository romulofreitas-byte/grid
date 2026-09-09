"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IntegrationHubCard } from "@/components/integracoes/IntegrationHubCard";
import { COPY } from "@/lib/copy";
import { planHasFeature } from "@/lib/billing/catalog";
import type { CrmFormChannel, CrmMetaConnection } from "@/lib/crm/types";
import { matchesAutomacoesCategory } from "@/lib/crm/types";
import { IMPORT_RUNS_QUERY_KEY } from "@/lib/crm/import-history";
import type { PublicImportRun } from "@/lib/crm/import-history";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { HUB_SECTIONS, filterHubItems, type HubItem } from "@/lib/integrations/hub";
import { useBillingMe } from "@/hooks/useBillingMe";

type MetaPagesResponse = {
  pages: CrmMetaConnection[];
};

type InboundList = {
  endpoints: Array<{ channel: CrmFormChannel }>;
};

type ConnectionsList = {
  connections: IntegrationConnectionPublic[];
};

type ImportRunsList = {
  runs: PublicImportRun[];
};

function countLabel(
  n: number,
  one: string,
  many: string,
): string {
  if (n <= 0) return COPY.integracoesStatusNone;
  if (n === 1) return one;
  return many.replace("{n}", String(n));
}

function statusForItem(
  item: HubItem,
  data: {
    pages: number;
    site: number;
    webhook: number;
    imports: number;
    voip: Record<string, number>;
  },
): string {
  if (item.availability === "soon") return COPY.integracoesStatusSoon;
  if (item.id === "meta") {
    return countLabel(
      data.pages,
      COPY.integracoesStatusPagesOne,
      COPY.integracoesStatusPagesMany,
    );
  }
  if (item.id === "site") {
    return countLabel(
      data.site,
      COPY.integracoesStatusOriginsOne,
      COPY.integracoesStatusOriginsMany,
    );
  }
  if (item.id === "planilha") {
    return data.imports > 0
      ? COPY.integracoesStatusConnected
      : COPY.integracoesStatusNone;
  }
  if (item.section === "automacoes") {
    return countLabel(
      data.webhook,
      COPY.integracoesStatusOriginsOne,
      COPY.integracoesStatusOriginsMany,
    );
  }
  const n = data.voip[item.id] ?? 0;
  if (item.id === "3cplus") {
    return n > 0 ? COPY.integracoesStatusConnected : COPY.integracoesStatusNone;
  }
  return countLabel(
    n,
    COPY.integracoesStatusVoipOne,
    COPY.integracoesStatusVoipMany,
  );
}

export function IntegracoesGallery() {
  const billing = useBillingMe();
  const [query, setQuery] = useState("");
  const automations = planHasFeature(
    billing.data?.balance.plano,
    "automations",
  );

  const pagesQuery = useQuery({
    queryKey: ["crm-meta-pages"],
    queryFn: async () => {
      const res = await fetch("/api/automacoes/meta/pages");
      if (!res.ok) throw new Error("pages");
      return (await res.json()) as MetaPagesResponse;
    },
    enabled: Boolean(billing.data) && automations,
  });

  const inboundQuery = useQuery({
    queryKey: ["crm-inbound"],
    queryFn: async () => {
      const res = await fetch("/api/crm/inbound");
      if (!res.ok) throw new Error("inbound");
      return (await res.json()) as InboundList;
    },
    enabled: Boolean(billing.data) && automations,
  });

  const connectionsQuery = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) throw new Error("connections");
      return (await res.json()) as ConnectionsList;
    },
    enabled: Boolean(billing.data),
  });

  const importsQuery = useQuery({
    queryKey: IMPORT_RUNS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/crm/import");
      if (!res.ok) throw new Error("imports");
      const json = (await res.json()) as ImportRunsList;
      return json.runs ?? [];
    },
    enabled: Boolean(billing.data),
  });

  const tallies = useMemo(() => {
    const endpoints = inboundQuery.data?.endpoints ?? [];
    const voip: Record<string, number> = {};
    for (const connection of connectionsQuery.data?.connections ?? []) {
      if (connection.status !== "active") continue;
      const id = connection.catalog_id ?? connection.provider;
      voip[id] = (voip[id] ?? 0) + 1;
    }
    return {
      pages: pagesQuery.data?.pages.length ?? 0,
      site: endpoints.filter((row) =>
        matchesAutomacoesCategory(row.channel, "captar"),
      ).length,
      webhook: endpoints.filter((row) =>
        matchesAutomacoesCategory(row.channel, "avancado"),
      ).length,
      imports: importsQuery.data?.length ?? 0,
      voip,
    };
  }, [
    connectionsQuery.data?.connections,
    importsQuery.data?.length,
    inboundQuery.data?.endpoints,
    pagesQuery.data?.pages.length,
  ]);

  const visible = filterHubItems(query);

  return (
    <div className="mt-3 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm text-podium-muted">{COPY.integracoesLead}</p>
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">{COPY.integracoesSearch}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={COPY.integracoesSearch}
            className="w-full rounded-md border border-white/10 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40"
          />
        </label>
      </div>
      {HUB_SECTIONS.map((section) => {
        const items = visible.filter((item) => item.section === section.id);
        if (items.length === 0) return null;
        const label =
          section.id === "captacao"
            ? COPY.integracoesSectionCaptacao
            : section.id === "automacoes"
              ? COPY.integracoesSectionAutomacoes
              : COPY.integracoesSectionTelefonia;
        return (
          <section key={section.id} className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
              {label}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <IntegrationHubCard
                  key={item.id}
                  item={item}
                  status={statusForItem(item, tallies)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
