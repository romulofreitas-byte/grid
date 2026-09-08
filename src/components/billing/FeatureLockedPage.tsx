"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import {
  StartingLights,
  type LightsPhase,
} from "@/components/StartingLights";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { buttonClassName } from "@/components/ui/Button";
import { withFrom } from "@/lib/billing/href";
import { isSkuOnSale } from "@/lib/billing/catalog";
import { paywallCopy } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function LightsShow({ compact }: { compact: boolean }) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<LightsPhase>(reduce ? "hold" : "idle");
  const [litCount, setLitCount] = useState(reduce ? 5 : 0);

  useEffect(() => {
    if (reduce) {
      setPhase("hold");
      setLitCount(5);
      return;
    }
    let cancelled = false;
    void (async () => {
      setPhase("lighting");
      setLitCount(0);
      for (let i = 1; i <= 5; i++) {
        if (cancelled) return;
        setLitCount(i);
        await sleep(95);
      }
      await sleep(160);
      if (cancelled) return;
      setPhase("hold");
    })();
    return () => {
      cancelled = true;
    };
  }, [reduce, run]);

  if (compact) {
    return (
      <StartingLights litCount={5} phase="hold" size="compact" className="justify-center" />
    );
  }

  return (
    <button
      type="button"
      aria-label={COPY.lockedLightsReplay}
      onClick={() => setRun((n) => n + 1)}
      className="mx-auto flex rounded-md px-3 py-1.5 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40"
    >
      <StartingLights litCount={litCount} phase={phase} className="justify-center" />
    </button>
  );
}

export function FeatureLockedPage({
  feature,
  trialExpired,
  from,
  compact = false,
}: {
  feature: "crm" | "automations";
  trialExpired: boolean;
  from: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const copy = paywallCopy({
    kind: trialExpired && feature === "crm" ? "trial" : "plan",
    feature,
  });
  const highlights =
    feature === "automations"
      ? [
          COPY.lockedAutomationsHighlight1,
          COPY.lockedAutomationsHighlight2,
          COPY.lockedAutomationsHighlight3,
        ]
      : [
          COPY.lockedCrmHighlight1,
          COPY.lockedCrmHighlight2,
          COPY.lockedCrmHighlight3,
        ];
  const waitlist =
    feature === "automations" && !trialExpired && !isSkuOnSale("piloto_pro") ? (
      <SupportWhatsAppButton
        pathname={from}
        intent="piloto_pro_waitlist"
        className={buttonClassName({
          variant: "primary",
          size: "md",
          className: "bg-podium-yellow text-podium-navy hover:brightness-110",
        })}
      >
        {COPY.landingPlansCtaWaitlist}
      </SupportWhatsAppButton>
    ) : null;

  const card = (
    <motion.div
      className={cn("w-full", compact ? "max-w-xl" : "max-w-lg")}
      initial={reduce || compact ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      whileHover={
        reduce || compact ? undefined : { y: -3, transition: { duration: 0.2 } }
      }
    >
      <GlassCard highlight hover={false} className="overflow-hidden p-0">
        <div className="podium-checkered shrink-0" />
        <div className={cn("px-4 py-5", compact ? "md:px-5" : "md:px-6 md:py-6")}>
          {compact ? null : <LightsShow compact={false} />}
          <p
            className={cn(
              "text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow",
              compact ? "" : "mt-4 text-center",
            )}
          >
            {copy.eyebrow}
          </p>
          <h2
            className={cn(
              "mt-2 text-balance text-lg font-semibold md:text-xl",
              compact ? "" : "text-center",
            )}
          >
            {copy.title}
          </h2>
          <p
            className={cn(
              "mt-2 text-pretty text-sm leading-relaxed text-podium-gray",
              compact ? "" : "text-center",
            )}
          >
            {copy.body}
          </p>

          {feature === "automations" && !compact ? (
            <p className="mt-5 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              {COPY.lockedAutomationsPreview}
            </p>
          ) : null}

          <ul className="mt-3 space-y-1.5">
            {highlights.map((line, index) => {
              const active = picked === index;
              return (
                <motion.li
                  key={line}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.18 + index * 0.08, ease: EASE }}
                >
                  <button
                    type="button"
                    onClick={() => setPicked(active ? null : index)}
                    className={cn(
                      "flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                      active
                        ? "bg-podium-yellow/10 text-podium-white"
                        : "text-podium-gray hover:bg-white/5 hover:text-podium-white",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-podium-yellow" : "text-podium-yellow/80",
                      )}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </button>
                </motion.li>
              );
            })}
          </ul>

          <AnimatePresence>
            {picked !== null ? (
              <motion.p
                key={picked}
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? undefined : { opacity: 0, height: 0 }}
                className="overflow-hidden px-2 pt-1 text-center text-xs text-podium-muted"
              >
                {COPY.lockedHighlightHint}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div
            className={cn(
              "mt-5 flex flex-wrap gap-2",
              compact ? "" : "justify-center",
            )}
          >
            {waitlist && copy.primary.external ? (
              waitlist
            ) : (
              <motion.div whileTap={reduce ? undefined : { scale: 0.98 }}>
                <Link
                  href={
                    "external" in copy.primary && copy.primary.external
                      ? copy.primary.href
                      : withFrom(copy.primary.href, from)
                  }
                  {...(copy.primary.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className={buttonClassName({ variant: "primary", size: "md" })}
                >
                  {copy.primary.label}
                </Link>
              </motion.div>
            )}
            {"href" in copy.secondary ? (
              <Link
                href={withFrom(copy.secondary.href, from)}
                className={buttonClassName({ variant: "secondary", size: "md" })}
              >
                {copy.secondary.label}
              </Link>
            ) : null}
          </div>
          {feature === "automations" && !trialExpired ? (
            <p className="mt-3 text-pretty text-center text-xs text-podium-muted">
              {COPY.landingPlansWaitlistHint}
            </p>
          ) : null}
        </div>
      </GlassCard>
    </motion.div>
  );

  if (compact) return card;

  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center self-stretch overflow-y-auto py-6">
      {card}
    </div>
  );
}
