"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { COPY } from "@/lib/copy";
import { activitySignal, formatNextAction } from "@/lib/crm/activity";
import type { CrmDealCard as Deal } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";

const CARD_SHELL =
  "w-full [contain-intrinsic-size:auto_5.5rem] [content-visibility:auto]";

export const CrmDealCardView = memo(function CrmDealCardView({
  deal,
  overlay = false,
  className,
}: {
  deal: Deal;
  overlay?: boolean;
  className?: string;
}) {
  const signal = activitySignal(deal.next_activity);
  const nextLine = formatNextAction(deal.next_activity, COPY.crmNoActivity);
  return (
    <div
      className={cn(
        "w-full rounded-md border border-white/[0.08] bg-white/[0.04] p-2.5 text-left backdrop-blur-xl transition",
        overlay && "shadow-xl shadow-black/40 ring-1 ring-podium-yellow/30",
        className,
      )}
    >
      <p className="text-xs font-semibold leading-snug text-podium-white">
        {deal.company_name}
      </p>
      {deal.contact_name ? (
        <p className="mt-0.5 truncate text-xs text-podium-gray">
          {deal.contact_name}
        </p>
      ) : null}
      {deal.phones?.[0] ? (
        <p className="mt-0.5 truncate font-mono text-[11px] text-podium-muted">
          {deal.phones[0]}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <CrmTelemetryPip signal={signal} />
        <p
          className={cn(
            "min-w-0 truncate text-[11px]",
            signal === "none" ? "text-podium-gray" : "text-podium-muted",
            signal === "overdue" && "text-podium-alert",
          )}
        >
          {nextLine}
        </p>
      </div>
    </div>
  );
});

export const CrmDealCard = memo(function CrmDealCard({
  deal,
  onOpen,
  dnd = true,
}: {
  deal: Deal;
  onOpen?: (dealId: string) => void;
  dnd?: boolean;
}) {
  if (!dnd) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(deal.id)}
        className={CARD_SHELL}
      >
        <DealCardFace deal={deal} />
      </button>
    );
  }
  return <CrmSortableDealCard deal={deal} onOpen={onOpen} />;
});

function CrmSortableDealCard({
  deal,
  onOpen,
}: {
  deal: Deal;
  onOpen?: (dealId: string) => void;
}) {
  const sortable = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });
  const style = {
    transform: sortable.isDragging
      ? undefined
      : CSS.Transform.toString(sortable.transform),
    transition: sortable.isDragging ? undefined : sortable.transition,
    opacity: sortable.isDragging ? 0 : undefined,
  };

  return (
    <button
      type="button"
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={() => onOpen?.(deal.id)}
      className={CARD_SHELL}
    >
      <DealCardFace deal={deal} />
    </button>
  );
}

function DealCardFace({ deal }: { deal: Deal }) {
  return (
    <CrmDealCardView
      deal={deal}
      className="hover:border-white/15 hover:bg-white/[0.06]"
    />
  );
}
