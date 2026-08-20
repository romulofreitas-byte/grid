"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Phone } from "lucide-react";
import { CallButton } from "@/components/CallButton";
import { SaveListButton } from "@/components/SaveListButton";
import { COPY } from "@/lib/copy";
import { leadHref, largadaNovaHref } from "@/lib/back";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import type { NextCallLead } from "@/lib/types";

export function BoxDayCta({
  next,
  hoje,
  pistaAberta,
  unsavedSearch,
  connections,
}: {
  next: NextCallLead | null;
  hoje: number;
  pistaAberta: boolean;
  unsavedSearch: { id: string; nome: string } | null;
  connections: IntegrationConnectionPublic[];
}) {
  const router = useRouter();
  const callConnection = pickCallConnection(connections);

  if (!pistaAberta) {
    if (unsavedSearch) {
      return (
        <div>
          <SaveListButton
            searchId={unsavedSearch.id}
            nome={unsavedSearch.nome}
            variant="cockpit"
          />
        </div>
      );
    }
    return (
      <Link
        href={largadaNovaHref}
        className="inline-flex items-center justify-center gap-3 rounded-xl bg-podium-yellow px-8 py-4 text-base font-extrabold text-podium-navy transition hover:brightness-110"
      >
        <Flag className="h-5 w-5" />
        {COPY.novaLista}
      </Link>
    );
  }

  if (!next) {
    return (
      <Link
        href={largadaNovaHref}
        className="inline-flex items-center justify-center gap-3 rounded-xl bg-podium-yellow px-8 py-4 text-base font-extrabold text-podium-navy transition hover:brightness-110"
      >
        <Flag className="h-5 w-5" />
        {COPY.novaLista}
      </Link>
    );
  }

  const fichaHref = leadHref(next.cnpj, next.searchId, "box");
  const idleLabel = hoje === 0 ? `Ligar o P${next.gridPosition}` : "Continuar a volta";

  if (callConnection) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <CallButton
          telHref={null}
          connection={callConnection}
          cnpj={next.cnpj}
          searchId={next.searchId}
          variant="cockpit"
          label={idleLabel}
          onCalled={() => router.push(fichaHref)}
        />
        <Link
          href={fichaHref}
          className="inline-flex items-center gap-2 text-sm font-bold text-podium-gray hover:text-podium-yellow"
        >
          Abrir ficha
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={fichaHref}
      className="inline-flex items-center justify-center gap-3 rounded-xl bg-podium-yellow px-8 py-4 text-base font-extrabold text-podium-navy transition hover:brightness-110"
    >
      <Phone className="h-5 w-5" />
      {idleLabel}
    </Link>
  );
}
