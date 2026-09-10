"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import {
  memo,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { CallButton } from "@/components/CallButton";
import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";
import { COPY } from "@/lib/copy";
import { activitySignal, formatNextAction } from "@/lib/crm/activity";
import {
  dealDialPhones,
  firstDialablePhone,
  formatPhoneDisplay,
  telHrefFromPhone,
} from "@/lib/crm/dial";
import { displayCrmName } from "@/lib/crm/display-name";
import { recordCrmDialAfterCall } from "@/lib/crm/record-dial";
import type { CrmDealCard as Deal } from "@/lib/crm/types";
import type { CallConnectionPick } from "@/lib/integrations/call-target";
import { invalidateLiveStats } from "@/lib/live-stats";
import { cn } from "@/lib/utils";

const CARD_SHELL =
  "group/card w-full [contain-intrinsic-size:auto_4.75rem] [content-visibility:auto]";

function stopCardAction(event: MouseEvent | PointerEvent | KeyboardEvent) {
  event.stopPropagation();
}

export const CrmDealCardView = memo(function CrmDealCardView({
  deal,
  overlay = false,
  className,
  callAction,
}: {
  deal: Deal;
  overlay?: boolean;
  className?: string;
  callAction?: ReactNode;
}) {
  const signal = activitySignal(deal.next_activity);
  const nextLine =
    signal === "none" ? null : formatNextAction(deal.next_activity, "");
  const contact = deal.contact_name.trim()
    ? displayCrmName(deal.contact_name)
    : "";
  const company = displayCrmName(deal.company_name);
  const phone = firstDialablePhone(dealDialPhones(deal));

  return (
    <div
      className={cn(
        "w-full rounded-md border border-white/[0.08] bg-white/[0.04] p-2.5 text-left backdrop-blur-xl transition",
        overlay && "shadow-xl shadow-black/40 ring-1 ring-podium-yellow/30",
        className,
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-semibold leading-snug text-podium-white"
            title={deal.company_name}
          >
            {company}
          </p>
          {contact ? (
            <p
              className="mt-0.5 truncate text-[11px] text-podium-muted"
              title={deal.contact_name}
            >
              {contact}
            </p>
          ) : null}
          {phone ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-podium-gray">
              {formatPhoneDisplay(phone)}
            </p>
          ) : null}
        </div>
        {callAction ? (
          <div
            className="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100"
            onClick={stopCardAction}
            onPointerDown={stopCardAction}
            onKeyDown={stopCardAction}
          >
            {callAction}
          </div>
        ) : null}
      </div>
      {nextLine ? (
        <div className="mt-2 flex items-center gap-2">
          <CrmTelemetryPip signal={signal} />
          <p
            className={cn(
              "min-w-0 truncate text-[11px] text-podium-muted",
              signal === "overdue" && "text-podium-alert",
            )}
          >
            {nextLine}
          </p>
        </div>
      ) : null}
    </div>
  );
});

export const CrmDealCard = memo(function CrmDealCard({
  deal,
  onOpen,
  onChange,
  connection = null,
  dnd = true,
}: {
  deal: Deal;
  onOpen?: (dealId: string) => void;
  onChange?: (deal: Deal) => void;
  connection?: CallConnectionPick | null;
  dnd?: boolean;
}) {
  if (!dnd) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(deal.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.(deal.id);
          }
        }}
        className={cn(CARD_SHELL, "cursor-pointer")}
      >
        <DealCardFace
          deal={deal}
          connection={connection}
          onChange={onChange}
        />
      </div>
    );
  }
  return (
    <CrmSortableDealCard
      deal={deal}
      onOpen={onOpen}
      onChange={onChange}
      connection={connection}
    />
  );
});

function CrmSortableDealCard({
  deal,
  onOpen,
  onChange,
  connection,
}: {
  deal: Deal;
  onOpen?: (dealId: string) => void;
  onChange?: (deal: Deal) => void;
  connection: CallConnectionPick | null;
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
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={() => onOpen?.(deal.id)}
      className={cn(CARD_SHELL, "cursor-grab active:cursor-grabbing")}
    >
      <DealCardFace deal={deal} connection={connection} onChange={onChange} />
    </div>
  );
}

function DealCardFace({
  deal,
  connection,
  onChange,
}: {
  deal: Deal;
  connection: CallConnectionPick | null;
  onChange?: (deal: Deal) => void;
}) {
  const qc = useQueryClient();
  const phone = firstDialablePhone(dealDialPhones(deal));
  const telHref = phone ? telHrefFromPhone(phone) : null;

  return (
    <CrmDealCardView
      deal={deal}
      className="hover:border-white/15 hover:bg-white/[0.06]"
      callAction={
        phone && telHref ? (
          <CallButton
            variant="card"
            skipRecord
            telHref={telHref}
            connection={connection}
            cnpj={deal.cnpj}
            searchId={deal.meta.searchId}
            to={phone}
            dealId={deal.id}
            titleHint={COPY.crmCallNow}
            companyName={displayCrmName(deal.company_name)}
            phoneLabel={formatPhoneDisplay(phone)}
            onCalled={() => {
              void recordCrmDialAfterCall(deal)
                .then((result) => {
                  onChange?.(result.deal);
                  void invalidateLiveStats(qc);
                })
                .catch(() => undefined);
            }}
          />
        ) : null
      }
    />
  );
}
