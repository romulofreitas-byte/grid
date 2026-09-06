"use client";

import { CatalogPicker } from "@/components/CatalogPicker";
import { Hint } from "@/components/Hint";
import { COPY } from "@/lib/copy";
import { CARGO_GROUPS, cargoChoice } from "@/lib/pilot-profile";

export function CargoFields({
  cargo,
  onCargo,
  commitText = "change",
  legend = true,
  variant = "default",
}: {
  cargo: string;
  onCargo: (value: string) => void;
  commitText?: "change" | "blur";
  legend?: boolean;
  variant?: "default" | "setup";
}) {
  return (
    <fieldset>
      {legend ? (
        <legend className="mb-2 text-xs text-podium-gray">
          Cargo
          <Hint className="mt-0.5">{COPY.cargoHint}</Hint>
        </legend>
      ) : null}
      <CatalogPicker
        groups={CARGO_GROUPS}
        value={cargo}
        selectedId={cargoChoice(cargo || null)}
        onChange={onCargo}
        outroPlaceholder={COPY.cargoOutroPlaceholder}
        commitText={commitText}
        variant={variant}
      />
    </fieldset>
  );
}
