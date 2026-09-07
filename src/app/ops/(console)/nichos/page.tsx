"use client";

import { NichosCuradoriaPanel } from "@/components/admin/NichosCuradoriaPanel";
import { SectionTitle } from "@/components/SectionTitle";
import { Hint } from "@/components/Hint";

export default function OpsNichosPage() {
  return (
    <div>
      <SectionTitle>Nichos</SectionTitle>
      <Hint className="mt-1">
        Curadoria do catálogo, agora no hub de Operações. Continua em
        /admin/nichos para quem entra como admin do produto.
      </Hint>
      <NichosCuradoriaPanel />
    </div>
  );
}
