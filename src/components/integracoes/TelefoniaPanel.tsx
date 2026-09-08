import Link from "next/link";
import { TelefoniaSetup } from "@/components/integracoes/TelefoniaSetup";
import { COPY } from "@/lib/copy";
import { integracoesHref } from "@/lib/back";
import { cn } from "@/lib/utils";

const TABS: { id: "voip" | "dialer"; label: string }[] = [
  { id: "voip", label: "VoIP" },
  { id: "dialer", label: "Discador" },
];

export function TelefoniaPanel({ tab }: { tab: "voip" | "dialer" }) {
  return (
    <div>
      <p className="mt-2 max-w-3xl text-pretty text-sm text-podium-muted">
        {COPY.telefoniaLead}
      </p>
      <div
        role="tablist"
        aria-label="Telefonia"
        className="mt-4 flex gap-1 border-b border-white/10"
      >
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
                "inline-flex min-h-11 shrink-0 items-center rounded-t-md px-3 text-xs font-medium md:min-h-0 md:py-1.5",
                active
                  ? "bg-podium-yellow/10 text-podium-yellow"
                  : "text-podium-muted hover:text-podium-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <TelefoniaSetup key={tab} kind={tab} />
    </div>
  );
}
