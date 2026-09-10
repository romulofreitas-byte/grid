"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { PlanPill } from "@/components/billing/PlanPill";
import { COPY } from "@/lib/copy";
import {
  formatBrl,
  type PackDefinition,
} from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex gap-2">
      <Check
        className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow"
        aria-hidden
      />
      {text}
    </li>
  );
}

export function PackCard({
  pack,
  featured = false,
  eyebrow,
  cta,
}: {
  pack: PackDefinition;
  featured?: boolean;
  eyebrow: string;
  cta: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const expandable =
    pack.details.length > 0 || (pack.notes?.length ?? 0) > 0;

  return (
    <GlassCard
      highlight={featured}
      className={cn(
        "flex h-full flex-col p-3 transition",
        featured && "ring-1 ring-podium-yellow/30",
      )}
    >
      <PlanPill
        label={eyebrow}
        tone={featured ? "yellow" : "muted"}
        className="self-start"
      />
      <h3 className="mt-2 text-base font-semibold">{pack.nome}</h3>
      <div className="mt-2 flex min-h-5 flex-wrap gap-1">
        {pack.badges.map((badge) => (
          <PlanPill
            key={badge.label}
            label={badge.label}
            tone={badge.tone}
          />
        ))}
      </div>
      <p className="mt-3 flex min-h-8 items-baseline whitespace-nowrap text-xl font-semibold text-podium-yellow">
        {formatBrl(pack.priceCents)}
      </p>
      <p className="mt-1 text-sm text-podium-muted">
        {pack.credits.toLocaleString("pt-BR")} créditos
      </p>
      {expandable ? (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 self-start text-sm font-bold text-podium-gray transition hover:text-podium-white"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? COPY.landingPlansShowLess : COPY.landingPlansShowAll}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      ) : null}
      {open && expandable ? (
        <div id={detailsId} className="mt-3">
          {pack.details.length > 0 ? (
            <ul className="space-y-2 text-sm text-podium-gray">
              {pack.details.map((line) => (
                <BenefitItem key={line} text={line} />
              ))}
            </ul>
          ) : null}
          {pack.notes?.length ? (
            <ul
              className={cn(
                "space-y-2 text-sm text-podium-muted",
                pack.details.length > 0 && "mt-2",
              )}
            >
              {pack.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto pt-3">{cta}</div>
    </GlassCard>
  );
}
