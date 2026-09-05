"use client";

import { CatalogPicker } from "@/components/CatalogPicker";
import { Hint } from "@/components/Hint";
import { COPY } from "@/lib/copy";
import { MARKET_GROUPS, marketChoice } from "@/lib/pilot-profile";

export function MarketFields({
  especialidade,
  onEspecialidade,
  commitText = "change",
  legend = true,
  variant = "default",
}: {
  especialidade: string;
  onEspecialidade: (value: string) => void;
  commitText?: "change" | "blur";
  legend?: boolean;
  variant?: "default" | "setup";
}) {
  return (
    <fieldset>
      {legend ? (
        <legend className="mb-2 text-sm text-podium-gray">
          Mercado
          <Hint className="mt-0.5">{COPY.especialidade}</Hint>
        </legend>
      ) : null}
      <CatalogPicker
        groups={MARKET_GROUPS}
        value={especialidade}
        selectedId={marketChoice(especialidade || null)}
        onChange={onEspecialidade}
        outroPlaceholder={COPY.marketOutroPlaceholder}
        commitText={commitText}
        variant={variant}
      />
    </fieldset>
  );
}
