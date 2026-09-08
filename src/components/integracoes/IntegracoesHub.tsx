"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { MetaConnectCard } from "@/components/integracoes/MetaConnectCard";
import { buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { INTEGRACOES_TELEFONIA } from "@/lib/back";
import { pagarHref } from "@/lib/billing/href";
import { isSkuOnSale, planHasFeature } from "@/lib/billing/catalog";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { useBillingMe } from "@/hooks/useBillingMe";

type MetaPagesResponse = {
  pages: CrmMetaConnection[];
  configured?: boolean;
};

function HubCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <GlassCard className="flex flex-col gap-3 p-4 hover:translate-y-0">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-podium-white">{title}</p>
        <p className="text-sm text-podium-gray">{body}</p>
      </div>
      <Link
        href={href}
        className={buttonClassName({
          variant: "secondary",
          className: "self-start",
        })}
      >
        {cta}
      </Link>
    </GlassCard>
  );
}

export function IntegracoesHub() {
  const billing = useBillingMe();
  const [metaFlash, setMetaFlash] = useState<string | null>(null);
  const automations = planHasFeature(
    billing.data?.balance.plano,
    "automations",
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (meta === "ok") setMetaFlash(COPY.automacoesMetaConnected);
    else if (meta === "denied") setMetaFlash(COPY.automacoesMetaDenied);
    else if (meta === "error") setMetaFlash(COPY.automacoesMetaError);
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
      if (!res.ok) return { pages: [] as CrmMetaConnection[], configured: false };
      return (await res.json()) as MetaPagesResponse;
    },
  });

  const proHref = isSkuOnSale("piloto_pro")
    ? pagarHref("piloto_pro", "/integracoes")
    : "/planos#piloto-pro";

  return (
    <div className="mt-3 space-y-4">
      <p className="max-w-3xl text-sm text-podium-muted">
        {COPY.integracoesLead}
      </p>
      {metaFlash ? (
        <p className="text-sm text-podium-gray">{metaFlash}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard className="flex flex-col gap-3 p-4 hover:translate-y-0 sm:col-span-2">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-podium-white">
              {COPY.integracoesFacebookTitle}
            </p>
            <p className="text-sm text-podium-gray">
              {COPY.integracoesFacebookBody}
            </p>
          </div>
          {billing.isLoading ? (
            <div className="h-8 w-40 animate-pulse rounded-md bg-white/5" />
          ) : automations ? (
            <MetaConnectCard
              pages={pagesQuery.data?.pages ?? []}
              configured={pagesQuery.data?.configured}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-podium-gray">
                {COPY.lockedAutomationsHighlight2}
              </p>
              <Link
                href={proHref}
                className={buttonClassName({
                  variant: "primary",
                  className: "self-start",
                })}
              >
                {COPY.integracoesProCta}
              </Link>
            </div>
          )}
        </GlassCard>
        <HubCard
          title={COPY.automacoesTitle}
          body={COPY.integracoesAutomacoesBody}
          href="/automacoes"
          cta={COPY.integracoesOpenAutomacoes}
        />
        <HubCard
          title={COPY.importacoesTitle}
          body={COPY.importacoesLead}
          href="/importacoes"
          cta={COPY.integracoesOpenImportacoes}
        />
        <HubCard
          title={COPY.telefoniaTitle}
          body={COPY.integracoesTelefoniaBody}
          href={INTEGRACOES_TELEFONIA}
          cta={COPY.integracoesOpenTelefonia}
        />
      </div>
    </div>
  );
}
