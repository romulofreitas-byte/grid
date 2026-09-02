"use client";

import { LANDING_LEADS } from "@/components/landing/demo-leads";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const COLUMNS = [
  { key: "entrada", title: "Entrada" },
  { key: "tentando", title: "Tentando contato" },
  { key: "reuniao", title: "Reunião" },
] as const;

type Col = (typeof COLUMNS)[number]["key"];

const FINAL: { nome: string; socio: string; col: Col }[] = [
  {
    nome: LANDING_LEADS[0].empresa,
    socio: LANDING_LEADS[0].socio,
    col: "entrada",
  },
  {
    nome: LANDING_LEADS[1].empresa,
    socio: LANDING_LEADS[1].socio,
    col: "tentando",
  },
  {
    nome: LANDING_LEADS[3].empresa,
    socio: LANDING_LEADS[3].socio,
    col: "entrada",
  },
  {
    nome: LANDING_LEADS[4].empresa,
    socio: LANDING_LEADS[4].socio,
    col: "reuniao",
  },
];

export function LandingCrmPreview({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, margin: "-80px" });
  const [cards, setCards] = useState<{ nome: string; socio: string; col: Col }[]>(
    () => (reduce ? FINAL : []),
  );

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setCards(FINAL);
      return;
    }
    setCards([]);
    const timers: number[] = [];
    // First the qualified list drops into Entrada.
    FINAL.forEach((card, i) => {
      timers.push(
        window.setTimeout(() => {
          setCards((prev) => [
            ...prev,
            { ...card, col: "entrada" },
          ]);
        }, 350 + i * 220),
      );
    });
    // Then a couple move forward — the CRM doing the work.
    timers.push(
      window.setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.nome === LANDING_LEADS[1].empresa
              ? { ...c, col: "tentando" }
              : c,
          ),
        );
      }, 350 + FINAL.length * 220 + 500),
    );
    timers.push(
      window.setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.nome === LANDING_LEADS[4].empresa
              ? { ...c, col: "reuniao" }
              : c,
          ),
        );
      }, 350 + FINAL.length * 220 + 900),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [inView, reduce]);

  return (
    <div
      ref={root}
      className={cn(
        "relative w-full overflow-x-auto rounded-2xl border border-white/10 bg-podium-panel/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-5",
        className,
      )}
      role="region"
      aria-label={COPY.landingCrmPreviewLabel}
    >
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
        {COPY.landingCrmPreviewLabel}
      </p>
      <div className="grid min-w-[28rem] grid-cols-3 gap-3">
        {COLUMNS.map((column) => {
          const inCol = cards.filter((c) => c.col === column.key);
          return (
            <div key={column.key} className="min-w-0">
              <p className="mb-2 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                {column.title}
              </p>
              <div className="min-h-[11rem] space-y-2 rounded-xl bg-black/20 p-2">
                {inCol.map((card) => (
                  <motion.div
                    key={card.nome}
                    layout
                    initial={reduce ? false : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2"
                  >
                    <p className="truncate text-xs font-bold text-podium-white">
                      {card.nome}
                    </p>
                    <p className="truncate text-[11px] text-podium-muted">
                      {card.socio}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
