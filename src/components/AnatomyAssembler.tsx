"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ANATOMY_BEATS,
  anatomyAssembly,
  CONSIDERATION_LINE,
  type AnatomySlot,
  type ScriptProfile,
} from "@/lib/golden-minute-script";
import { cn } from "@/lib/utils";

function focusField(fieldId: string) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  const target =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLButtonElement
      ? el
      : el.querySelector<HTMLElement>("input, textarea, button");
  target?.focus();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function SlotChip({
  slot,
  active,
}: {
  slot: AnatomySlot;
  active: boolean;
}) {
  const filled = Boolean(slot.value);
  return (
    <button
      type="button"
      data-slot={slot.id}
      onClick={() => focusField(slot.fieldId)}
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 align-baseline text-sm leading-snug transition",
        filled
          ? "border-podium-yellow/50 bg-podium-yellow/15 font-semibold text-podium-yellow"
          : "border-dashed border-white/25 font-medium text-podium-muted",
        active && "ring-2 ring-podium-yellow/55 ring-offset-0",
      )}
    >
      <span className="truncate">{filled ? slot.value : slot.label}</span>
    </button>
  );
}

function LockedBeat({
  index,
  hint,
}: {
  index: number;
  hint: string;
}) {
  return (
    <li className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
        {index + 1} · {ANATOMY_BEATS[index]}
      </p>
      <p className="mt-1 text-xs text-podium-muted">{hint}</p>
    </li>
  );
}

export function AnatomyAssembler({
  profile,
  step,
}: {
  profile: ScriptProfile;
  step?: number;
}) {
  const reduce = useReducedMotion();
  const slots = anatomyAssembly(profile);
  const sealed = Boolean(slots.promessa.value);
  const beat2Open = sealed;
  const beat3Open = step == null || step >= 2;
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const node = event.target as HTMLElement | null;
      const id = node?.id || node?.closest("[id]")?.id || null;
      if (
        id === "como_chama" ||
        id === "tratamento" ||
        id === "empresa_usuario" ||
        id === "cidade_usuario" ||
        id === "promessa" ||
        id === "duracao_reuniao"
      ) {
        setActiveField(id);
      }
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className="rounded-xl border border-white/10 bg-podium-navy/60 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
        Briefing da ligação
      </p>

      <motion.button
        type="button"
        onClick={() => focusField("promessa")}
        layout
        transition={{ duration: reduce ? 0 : 0.22, ease }}
        className={cn(
          "mt-3 w-full rounded-2xl border px-4 py-4 text-left transition",
          sealed
            ? "border-podium-yellow/50 bg-podium-yellow/10"
            : "border-dashed border-white/20 bg-white/[0.02]",
        )}
      >
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.18em]",
            sealed ? "text-podium-yellow" : "text-podium-muted",
          )}
        >
          {sealed ? "Compromisso do piloto" : "Compromisso do dia"}
        </p>
        <motion.p
          key={sealed ? "sealed" : "empty"}
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.2, ease }}
          className={cn(
            "mt-2 text-pretty",
            sealed
              ? "text-base font-semibold leading-snug text-podium-yellow md:text-lg"
              : "text-sm leading-snug text-podium-muted",
          )}
        >
          {sealed
            ? slots.promessa.value
            : step != null && step < 2
              ? "Escreva a promessa na Oferta"
              : "Sela o que você entrega"}
        </motion.p>
      </motion.button>

      <ol className="mt-4 space-y-2">
        <li>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
            1 · {ANATOMY_BEATS[0]}
          </p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1.5 text-sm leading-relaxed text-podium-gray">
            <span>Olá João, aqui é</span>
            <SlotChip slot={slots.artigo} active={activeField === slots.artigo.fieldId} />
            <SlotChip slot={slots.nome} active={activeField === slots.nome.fieldId} />
            <span>da</span>
            <SlotChip slot={slots.empresa} active={activeField === slots.empresa.fieldId} />
            <span>de</span>
            <span className="inline-flex max-w-full items-baseline">
              <SlotChip slot={slots.cidade} active={activeField === slots.cidade.fieldId} />
              .
            </span>
          </p>
        </li>

        <AnimatePresence initial={false}>
          {beat2Open ? (
            <motion.li
              key="beat-2"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease }}
              className="overflow-hidden"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                2 · {ANATOMY_BEATS[1]}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-podium-gray">
                {CONSIDERATION_LINE}
              </p>
            </motion.li>
          ) : (
            <LockedBeat
              key="beat-2-locked"
              index={1}
              hint="A promessa abre esta pergunta"
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {beat3Open ? (
            <motion.li
              key="beat-3"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease }}
              className="overflow-hidden"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                3 · {ANATOMY_BEATS[2]}
              </p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1.5 text-sm leading-relaxed text-podium-gray">
                <span>Queria te mostrar isso em</span>
                <SlotChip
                  slot={slots.duracao}
                  active={activeField === slots.duracao.fieldId}
                />
                <span>minutos. Como está sua agenda?</span>
              </p>
            </motion.li>
          ) : (
            <LockedBeat
              key="beat-3-locked"
              index={2}
              hint="A oferta entra no convite da reunião"
            />
          )}
        </AnimatePresence>
      </ol>
    </div>
  );
}
