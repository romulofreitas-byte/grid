import Link from "next/link";
import { IntegracoesFocusHeader } from "@/components/integracoes/IntegracoesFocusHeader";
import { TelefoniaSetup } from "@/components/integracoes/TelefoniaSetup";
import { COPY } from "@/lib/copy";
import { integracoesHref } from "@/lib/back";
import { getHubItem } from "@/lib/integrations/hub";
import { cn } from "@/lib/utils";

const TABS: { id: "voip" | "dialer"; label: string }[] = [
  { id: "voip", label: "VoIP" },
  { id: "dialer", label: "Discador" },
];

export function TelefoniaPanel({
  tab,
  provider,
}: {
  tab: "voip" | "dialer";
  provider?: string;
}) {
  const identity = getHubItem(tab === "dialer" ? "3cplus" : "api4com");
  return (
    <div className="mt-3 space-y-4">
      <IntegracoesFocusHeader
        item={identity}
        title={COPY.telefoniaTitle}
        status={COPY.telefoniaLead}
      />
      <div role="tablist" aria-label="Telefonia" className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={integracoesHref(item.id === "dialer" ? "dialer" : "voip")}
              replace
              scroll={false}
              role="tab"
              aria-selected={active}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium md:min-h-0 md:py-1.5",
                active
                  ? "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow"
                  : "border-white/10 bg-white/5 text-podium-muted hover:border-podium-yellow/35 hover:text-podium-yellow",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <TelefoniaSetup key={tab} kind={tab} provider={provider} />
    </div>
  );
}
