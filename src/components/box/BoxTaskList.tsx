"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { MessageCircle } from "lucide-react";
import {
  formatBoxPhoneDisplay,
  pickBoxTel,
  pickBoxWaHref,
} from "@/components/box/dial";
import { CallButton } from "@/components/CallButton";
import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";
import { formatPlannedActivity } from "@/lib/crm/activity";
import type { BoxQueueItem } from "@/lib/box/queue";
import { COPY } from "@/lib/copy";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

function stopRowAction(event: MouseEvent) {
  event.stopPropagation();
}

function BoxQueueRow({
  item,
  connections,
  onFocus,
}: {
  item: BoxQueueItem;
  connections: IntegrationConnectionPublic[];
  onFocus: () => void;
}) {
  const callConnection = pickCallConnection(connections);
  const tel = pickBoxTel(item);
  const waHref = pickBoxWaHref(item);
  const planned = formatPlannedActivity({
    kind: item.kind,
    due_at: item.dueAt,
    status: "open",
  });

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onFocus}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFocus();
          }
        }}
        className="group/row flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5"
      >
        <CrmTelemetryPip signal={item.signal} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-podium-white">
            {item.companyName}
          </span>
          <span className="block truncate text-[11px] text-podium-muted">
            {planned ?? item.stageNome}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 opacity-100 transition-opacity",
            "md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100",
          )}
          onClick={stopRowAction}
        >
          {item.kind === "whatsapp" ? (
            waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-podium-muted hover:bg-white/10 hover:text-podium-yellow"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            ) : null
          ) : tel || callConnection ? (
            <CallButton
              variant="card"
              iconOnly
              telHref={tel?.href ?? null}
              connection={callConnection}
              cnpj={item.cnpj}
              searchId={item.searchId}
              to={tel?.phone}
              titleHint="Ligar"
              companyName={item.companyName}
              phoneLabel={tel ? formatBoxPhoneDisplay(tel.phone) : COPY.boxNoPhone}
            />
          ) : null}
        </span>
      </div>
    </li>
  );
}

export function BoxTaskList({
  rows,
  empty,
  connections,
  onFocus,
}: {
  rows: BoxQueueItem[];
  empty: string;
  connections: IntegrationConnectionPublic[];
  onFocus: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-podium-muted">{empty}</p>;
  }

  return (
    <ul>
      {rows.map((row) => (
        <BoxQueueRow
          key={row.id}
          item={row}
          connections={connections}
          onFocus={() => onFocus(row.id)}
        />
      ))}
    </ul>
  );
}
