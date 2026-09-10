"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import {
  formatBrl,
  type PlanBadgeTone,
  type PlanDefinition,
} from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

const BADGE_TONE: Record<PlanBadgeTone, string> = {
  yellow:
    "border-podium-yellow/40 bg-podium-yellow/15 text-podium-yellow",
  muted: "border-white/15 bg-white/[0.04] text-podium-gray",
  success: "border-podium-success/35 bg-podium-success/15 text-podium-success",
  sky: "border-sky-400/35 bg-sky-400/15 text-sky-300",
};

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

function PlanPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: PlanBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        BADGE_TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function PlanCard({
  plan,
  featured = false,
  eyebrow,
  cta,
  variant = "glass",
}: {
  plan: PlanDefinition;
  featured?: boolean;
  eyebrow: string;
  cta: ReactNode;
  variant?: "glass" | "landing";
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const expandable =
    plan.details.length > 0 || (plan.notes?.length ?? 0) > 0;
  const price =
    plan.priceCents === 0 ? "Grátis" : formatBrl(plan.priceCents);

  const inner = (
    <>
      <PlanPill
        label={eyebrow}
        tone={featured ? "yellow" : "muted"}
        className="self-start"
      />
      <h3 className="mt-2 text-base font-semibold">{plan.nome}</h3>
      <div className="mt-2 flex min-h-5 flex-wrap gap-1">
        {plan.badges.map((badge) => (
          <PlanPill
            key={badge.label}
            label={badge.label}
            tone={badge.tone}
          />
        ))}
      </div>
      <p className="mt-3 flex min-h-8 items-baseline whitespace-nowrap text-xl font-semibold text-podium-yellow">
        {price}
        {plan.priceCents > 0 ? (
          <span className="text-sm font-medium text-podium-muted">/mês</span>
        ) : null}
      </p>
      <ul className="mt-4 min-h-[11rem] space-y-2 text-sm text-podium-gray">
        {plan.highlights.map((line) => (
          <BenefitItem key={line} text={line} />
        ))}
      </ul>
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
          {plan.details.length > 0 ? (
            <ul className="space-y-2 text-sm text-podium-gray">
              {plan.details.map((line) => (
                <BenefitItem key={line} text={line} />
              ))}
            </ul>
          ) : null}
          {plan.notes?.length ? (
            <ul
              className={cn(
                "space-y-2 text-sm text-podium-muted",
                plan.details.length > 0 && "mt-2",
              )}
            >
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto pt-3">{cta}</div>
    </>
  );

  if (variant === "landing") {
    return (
      <article
        className={cn(
          "flex h-full flex-col rounded-md border bg-white/[0.03] p-3",
          featured
            ? "border-podium-yellow/40 ring-1 ring-podium-yellow/25"
            : "border-white/[0.08]",
        )}
      >
        {inner}
      </article>
    );
  }

  return (
    <GlassCard
      highlight={featured}
      className={cn(
        "flex h-full flex-col p-3",
        featured && "ring-1 ring-podium-yellow/30",
      )}
    >
      {inner}
    </GlassCard>
  );
}
