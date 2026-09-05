"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import { formatBrl, type PlanDefinition } from "@/lib/billing/catalog";
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
      <p
        className={cn(
          "h-4 text-[10px] font-bold uppercase tracking-[0.18em]",
          featured ? "text-podium-yellow" : "text-podium-muted",
        )}
      >
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-extrabold">{plan.nome}</h3>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-pretty text-sm leading-5 text-podium-muted">
        {plan.tagline}
      </p>
      <p className="mt-4 flex min-h-[2.5rem] items-baseline whitespace-nowrap text-3xl font-extrabold text-podium-yellow">
        {price}
        {plan.priceCents > 0 ? (
          <span className="text-sm font-medium text-podium-muted">/mês</span>
        ) : null}
      </p>
      <ul className="mt-4 min-h-[8.5rem] space-y-2 text-sm text-podium-gray">
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
      <div className="mt-auto pt-6">{cta}</div>
    </>
  );

  if (variant === "landing") {
    return (
      <article
        className={cn(
          "flex h-full flex-col rounded-2xl border bg-white/[0.03] p-5",
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
        "flex h-full flex-col p-5",
        featured && "ring-1 ring-podium-yellow/30",
      )}
    >
      {inner}
    </GlassCard>
  );
}
