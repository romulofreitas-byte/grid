"use client";

import { useEffect, useState } from "react";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import type { CatalogGroup } from "@/lib/pilot-profile";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

const setupFieldClass =
  "mt-3 w-full max-w-md border-b border-white/20 bg-transparent pb-2 text-lg font-semibold outline-none focus:border-podium-yellow/60";

export function CatalogPicker({
  groups,
  value,
  selectedId,
  onChange,
  outroPlaceholder,
  commitText = "change",
  variant = "default",
}: {
  groups: readonly CatalogGroup[];
  value: string;
  selectedId: string | null;
  onChange: (value: string) => void;
  outroPlaceholder: string;
  commitText?: "change" | "blur";
  variant?: "default" | "setup";
}) {
  const storedOutro =
    selectedId === "outro" && value.trim() && value.trim() !== "outro"
      ? value
      : "";
  const [outroDraft, setOutroDraft] = useState(storedOutro);
  const setup = variant === "setup";

  useEffect(() => {
    setOutroDraft(storedOutro);
  }, [storedOutro]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id}>
          {group.label ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
              {group.label}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.options.map((option) => (
              <ChoiceTile
                key={option.id}
                density={setup ? "chip" : "compact"}
                selected={selectedId === option.id}
                className={setup ? "min-h-10 px-2" : "min-h-11 px-2"}
                onClick={() =>
                  onChange(
                    option.id === "outro"
                      ? outroDraft.trim() || "outro"
                      : option.id,
                  )
                }
              >
                {option.label}
              </ChoiceTile>
            ))}
          </div>
        </div>
      ))}
      {selectedId === "outro" ? (
        <input
          value={outroDraft}
          placeholder={outroPlaceholder}
          onChange={(e) => {
            const next = e.target.value;
            setOutroDraft(next);
            if (commitText === "change") onChange(next.trim() || "outro");
          }}
          onBlur={() => {
            if (commitText === "blur") onChange(outroDraft.trim() || "outro");
          }}
          className={cn(setup ? setupFieldClass : fieldClass)}
        />
      ) : null}
    </div>
  );
}
