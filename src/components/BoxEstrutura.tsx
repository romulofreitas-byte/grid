"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { COPY } from "@/lib/copy";
import type { BoxSlot, BoxSlotId } from "@/lib/box-estrutura";
import { cn } from "@/lib/utils";

function nextGapId(gaps: BoxSlot[], currentId: BoxSlotId): BoxSlotId | null {
  if (gaps.length <= 1) return null;
  const idx = gaps.findIndex((slot) => slot.id === currentId);
  const next = gaps[idx + 1] ?? gaps[0];
  return next?.id ?? null;
}

export function BoxEstrutura({
  slots,
  defaultOpen,
  pistaAberta,
  children,
}: {
  slots: BoxSlot[];
  defaultOpen: BoxSlotId | null;
  pistaAberta: boolean;
  children: (parts: { lamps: ReactNode; well: ReactNode }) => ReactNode;
}) {
  const gaps = slots.filter((slot) => !slot.done);
  const [openId, setOpenId] = useState<BoxSlotId | null>(() =>
    pistaAberta ? null : (defaultOpen ?? gaps[0]?.id ?? null),
  );
  const panel = openId
    ? (slots.find((slot) => slot.id === openId && !slot.done) ?? null)
    : null;
  const canSkip = gaps.length > 1;
  const missionOwnsCta = panel?.id === "lista";

  function skipStep() {
    if (!panel) return;
    const next = nextGapId(gaps, panel.id);
    setOpenId(next);
  }

  const lamps = (
    <div
      role="group"
      aria-label={COPY.boxEstrutura}
      className="flex items-center justify-end gap-2.5"
    >
      {slots.map((slot) => {
        const open = !slot.done && slot.id === openId;
        return (
          <button
            key={slot.id}
            type="button"
            title={slot.label}
            aria-pressed={open}
            aria-label={`${slot.label}${slot.done ? " pronto" : " falta"}`}
            disabled={slot.done}
            onClick={() => {
              if (slot.done) return;
              setOpenId((current) => (current === slot.id ? null : slot.id));
            }}
            className="group relative flex h-5 w-5 items-center justify-center disabled:cursor-default"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border-2 transition",
                slot.done && "border-podium-yellow bg-podium-yellow",
                open && "recommend-pulse border-podium-yellow bg-transparent",
                !slot.done && !open && "border-white/25 bg-transparent",
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold",
                open ? "text-podium-yellow" : "text-podium-muted",
                open
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              {slot.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const well = panel ? (
    <div className="mb-6 rounded-xl border border-podium-yellow/20 bg-black/20 px-4 py-3">
      <p className="text-sm font-extrabold">{panel.title}</p>
      <p className="mt-1 text-sm text-podium-gray">{panel.body}</p>
      {missionOwnsCta ? (
        canSkip ? (
          <button
            type="button"
            onClick={skipStep}
            className="mt-2 text-sm text-podium-muted hover:text-podium-white"
          >
            {COPY.boxPularEtapa}
          </button>
        ) : null
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={panel.href}
            className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-extrabold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-yellow"
          >
            {panel.cta}
          </Link>
          {canSkip ? (
            <button
              type="button"
              onClick={skipStep}
              className="text-sm text-podium-muted hover:text-podium-white"
            >
              {COPY.boxPularEtapa}
            </button>
          ) : null}
        </div>
      )}
    </div>
  ) : null;

  return <>{children({ lamps, well })}</>;
}
