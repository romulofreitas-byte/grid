import Link from "next/link";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { Badge } from "@/components/ui/Badge";
import { COPY } from "@/lib/copy";
import type { HubItem } from "@/lib/integrations/hub";
import { cn } from "@/lib/utils";

export function IntegrationHubCard({
  item,
  status,
  selected = false,
  onSelect,
  className,
}: {
  item: HubItem;
  status?: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const soon = item.availability === "soon" || (!item.href && !onSelect);
  const label = soon
    ? COPY.integracoesCtaSoon
    : status && status !== COPY.integracoesStatusNone
      ? COPY.integracoesCtaOpen
      : COPY.integracoesCtaIntegrar;
  const statusLine = soon
    ? COPY.integracoesStatusSoon
    : (status ?? COPY.integracoesStatusNone);

  const inner = (
    <>
      <IntegrationLogo item={item} size="hub" active={!soon} />
      <p className="mt-3 text-sm font-semibold text-podium-white">{item.name}</p>
      <p className="mt-1 min-h-[1.1rem] text-[11px] text-podium-muted">{statusLine}</p>
      {soon ? null : (
        <span className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-gradient-to-b from-[#ffc933] to-podium-yellow px-3 text-[11px] font-medium text-podium-navy">
          {label}
        </span>
      )}
      {soon ? (
        <Badge variant="neutral" className="absolute right-2 top-2">
          {COPY.integracoesStatusSoon}
        </Badge>
      ) : null}
    </>
  );

  const cardClass = cn(
    "relative flex h-full flex-col items-center rounded-xl border bg-white/[0.04] px-4 py-5 text-center backdrop-blur-xl transition",
    selected
      ? "border-podium-yellow/45 bg-white/[0.07]"
      : "border-white/[0.08]",
    soon
      ? "cursor-not-allowed opacity-70"
      : "hover:border-podium-yellow/35 hover:bg-white/[0.07]",
    className,
  );

  if (soon) {
    return (
      <div className={cardClass} aria-disabled>
        {inner}
      </div>
    );
  }

  if (onSelect) {
    return (
      <button type="button" className={cn(cardClass, "w-full")} onClick={onSelect}>
        {inner}
      </button>
    );
  }

  if (!item.href) {
    return (
      <div className={cardClass} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={item.href} className={cardClass}>
      {inner}
    </Link>
  );
}
