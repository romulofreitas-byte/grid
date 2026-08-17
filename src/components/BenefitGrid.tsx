"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

const SLOTS = [
  {
    pos: 1,
    label: "POLE",
    t: "Telefone da empresa",
    d: "Avisa quando o número é da contabilidade, não de quem decide.",
  },
  {
    pos: 2,
    label: "GRID DA FRENTE",
    t: "Sócio que decide",
    d: "O nome de quem pode fechar já vem na lista, para a primeira ligação.",
  },
  {
    pos: 3,
    label: "ORDEM",
    t: "Ligue de cima para baixo",
    d: "P1, P2, P3… o GRID já escolheu quem ligar primeiro.",
  },
] as const;

export function BenefitGrid() {
  const [active, setActive] = useState(1);

  return (
    <div className="grid overflow-hidden rounded-2xl border border-white/10 md:grid-cols-3">
      {SLOTS.map((slot, i) => {
        const on = active === slot.pos;
        return (
          <button
            key={slot.pos}
            type="button"
            onMouseEnter={() => setActive(slot.pos)}
            onFocus={() => setActive(slot.pos)}
            onClick={() => setActive(slot.pos)}
            className={cn(
              "relative min-h-0 px-5 py-4 text-left transition duration-300 md:px-6 md:py-5",
              on
                ? "bg-podium-yellow/12"
                : "bg-white/[0.03] hover:bg-white/[0.06]",
              i > 0 && "border-t border-white/10 md:border-l md:border-t-0",
            )}
          >
            {on ? (
              <span className="absolute inset-y-0 left-0 w-0.5 bg-podium-yellow md:w-1" />
            ) : null}
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "font-extrabold text-2xl tracking-tight md:text-3xl",
                  on ? "text-podium-yellow" : "text-podium-muted",
                )}
              >
                P{slot.pos}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.18em]",
                  on ? "text-podium-yellow" : "text-podium-muted",
                )}
              >
                {slot.label}
              </span>
            </div>
            <h3 className="mt-2 font-bold text-podium-white md:mt-3">
              {slot.t}
            </h3>
            <p
              className={cn(
                "mt-1 text-sm leading-snug text-podium-muted transition-opacity duration-300",
                on ? "opacity-100" : "opacity-70",
              )}
            >
              {slot.d}
            </p>
          </button>
        );
      })}
    </div>
  );
}
