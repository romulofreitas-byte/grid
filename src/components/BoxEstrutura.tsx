"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { SaveListButton } from "@/components/SaveListButton";
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
  unsavedSearch,
  children,
}: {
  slots: BoxSlot[];
  defaultOpen: BoxSlotId | null;
  unsavedSearch: { id: string; nome: string } | null;
  children: ReactNode;
}) {
  const gaps = slots.filter((slot) => !slot.done);
  const [openId, setOpenId] = useState<BoxSlotId | null>(
    defaultOpen ?? gaps[0]?.id ?? null,
  );
  const panel =
    slots.find((slot) => slot.id === openId && !slot.done) ?? gaps[0] ?? null;
  const canSkip = gaps.length > 1;

  function skipStep() {
    if (!panel) return;
    const next = nextGapId(gaps, panel.id);
    if (next) setOpenId(next);
  }

  return (
    <div className="border-b border-white/[0.08]">
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-8 md:px-6">
        {children}
        <div className="min-w-0 md:max-w-lg md:flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-podium-muted md:text-right">
            {COPY.boxEstrutura}
          </p>
          <div
            role="group"
            aria-label={COPY.boxEstrutura}
            className="mt-2 flex items-start justify-between gap-1"
          >
            {slots.map((slot) => {
              const open = !slot.done && slot.id === openId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-pressed={open}
                  aria-label={`${slot.label}${slot.done ? " pronto" : " falta"}`}
                  disabled={slot.done}
                  onClick={() => {
                    if (!slot.done) setOpenId(slot.id);
                  }}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border-2 transition md:h-3 md:w-3",
                      slot.done && "border-podium-yellow bg-podium-yellow",
                      open && "recommend-pulse border-podium-yellow bg-transparent",
                      !slot.done && !open && "border-white/20 bg-transparent",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-bold leading-tight md:text-[10px]",
                      slot.done || open
                        ? "text-podium-yellow"
                        : "text-podium-muted",
                    )}
                  >
                    {slot.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {panel ? (
        <div className="mx-5 mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 audit-gap-pulse md:mx-6">
          <p className="text-sm font-extrabold">{panel.title}</p>
          <p className="mt-1 text-sm text-podium-gray">{panel.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {panel.id === "lista" && unsavedSearch ? (
              <SaveListButton
                searchId={unsavedSearch.id}
                nome={unsavedSearch.nome}
              />
            ) : (
              <Link
                href={panel.href}
                className="inline-flex rounded-xl bg-podium-yellow px-4 py-2 text-sm font-extrabold text-podium-navy hover:brightness-110"
              >
                {panel.cta}
              </Link>
            )}
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
        </div>
      ) : null}
    </div>
  );
}
