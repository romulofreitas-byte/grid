"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
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
}: {
  slots: BoxSlot[];
  defaultOpen: BoxSlotId | null;
  unsavedSearch: { id: string; nome: string } | null;
}) {
  const gaps = slots.filter((slot) => !slot.done);
  const [openId, setOpenId] = useState<BoxSlotId | null>(
    defaultOpen ?? gaps[0]?.id ?? null,
  );
  const panel =
    slots.find((slot) => slot.id === openId && !slot.done) ?? gaps[0] ?? null;

  if (!panel) return null;

  const canSkip = gaps.length > 1;

  function skipStep() {
    const next = nextGapId(gaps, panel!.id);
    if (next) setOpenId(next);
  }

  return (
    <GlassCard className="p-5" highlight>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
        {COPY.boxEstrutura}
      </p>
      <div className="mt-4 flex items-start justify-between gap-1">
        {slots.map((slot) => {
          const open = !slot.done && slot.id === openId;
          return (
            <button
              key={slot.id}
              type="button"
              aria-pressed={open}
              aria-label={`${slot.label}${slot.done ? " pronto" : " falta"}`}
              onClick={() => {
                if (!slot.done) setOpenId(slot.id);
              }}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition",
                  slot.done && "border-podium-yellow bg-podium-yellow",
                  open && "recommend-pulse border-podium-yellow bg-transparent",
                  !slot.done && !open && "border-white/20 bg-transparent",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-bold leading-tight",
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
      <div className="mt-5 rounded-xl border border-white/10 px-4 pb-4 pt-4 audit-gap-pulse">
        <p className="text-sm font-extrabold">{panel.title}</p>
        <p className="mt-1 text-sm text-podium-gray">{panel.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
    </GlassCard>
  );
}
