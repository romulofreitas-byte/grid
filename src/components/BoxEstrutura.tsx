"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { SaveListButton } from "@/components/SaveListButton";
import { COPY } from "@/lib/copy";
import type { BoxSlot, BoxSlotId } from "@/lib/box-estrutura";
import { cn } from "@/lib/utils";

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

  return (
    <GlassCard className="p-5" highlight>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
        {COPY.boxEstrutura}
      </p>
      <div className="mt-4 flex items-start justify-between gap-1">
        {slots.map((slot) => {
          const active = !slot.done && slot.id === panel.id;
          return (
            <button
              key={slot.id}
              type="button"
              aria-pressed={active}
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
                  active &&
                    "recommend-pulse border-podium-yellow bg-transparent",
                  !slot.done &&
                    !active &&
                    "border-white/20 bg-transparent",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-bold leading-tight",
                  slot.done || active
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
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm font-extrabold">{panel.title}</p>
        <p className="mt-1 text-sm text-podium-gray">{panel.body}</p>
        {panel.id === "lista" && unsavedSearch ? (
          <div className="mt-4">
            <SaveListButton
              searchId={unsavedSearch.id}
              nome={unsavedSearch.nome}
            />
          </div>
        ) : (
          <Link
            href={panel.href}
            className="mt-4 inline-flex rounded-xl bg-podium-yellow px-4 py-2 text-sm font-extrabold text-podium-navy hover:brightness-110"
          >
            {panel.cta}
          </Link>
        )}
      </div>
    </GlassCard>
  );
}
