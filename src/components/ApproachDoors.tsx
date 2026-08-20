"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Users } from "lucide-react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { FichaChip } from "@/components/FichaChip";
import { COPY } from "@/lib/copy";
import { yearsSince } from "@/lib/format";
import type { LeadEnrichment, PartnerCard, SitePerson } from "@/lib/types";
import { cn } from "@/lib/utils";

function socioLine(s: PartnerCard): string {
  const years = yearsSince(s.dataEntrada);
  const tenure = years != null ? ` · sócio há ${years} anos` : "";
  return `${s.qualificacao}${tenure}`;
}

function Chip({
  children,
  emphasize = false,
}: {
  children: string;
  emphasize?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-xl border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        emphasize
          ? "border-podium-yellow/50 bg-podium-yellow/10 text-podium-yellow"
          : "border-white/15 text-podium-gray",
      )}
    >
      {children}
    </span>
  );
}

function PersonRow({
  nome,
  detail,
  chips,
}: {
  nome: string;
  detail: string;
  chips: Array<{ label: string; emphasize?: boolean }>;
}) {
  return (
    <li className="rounded-xl border border-white/10 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm font-bold text-podium-white">{nome}</p>
        {chips.map((c) => (
          <Chip key={c.label} emphasize={c.emphasize}>
            {c.label}
          </Chip>
        ))}
      </div>
      <p className="mt-0.5 text-xs text-podium-muted">{detail}</p>
    </li>
  );
}

function DoorsList({
  others,
  peopleExtracted,
  sitePeople,
  enrichment,
}: {
  others: PartnerCard[];
  peopleExtracted: boolean;
  sitePeople: SitePerson[];
  enrichment: LeadEnrichment | null;
}) {
  return (
    <>
      {others.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
            {COPY.quadroReceita}
          </p>
          <ul className="mt-2 space-y-2">
            {others.map((s) => (
              <PersonRow
                key={`${s.nome}-${s.qualificacao}`}
                nome={s.nome}
                detail={socioLine(s)}
                chips={s.kindLabel ? [{ label: s.kindLabel }] : []}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className={others.length > 0 ? "mt-3" : undefined}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
          {COPY.nomesNoSite}
        </p>
        {!enrichment || !peopleExtracted ? (
          <p className="mt-2 text-sm text-podium-muted">{COPY.qualifiqueNomesSite}</p>
        ) : sitePeople.length === 0 ? (
          <p className="mt-2 text-sm text-podium-muted">{COPY.nenhumNomeSite}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sitePeople.map((p) => (
              <PersonRow
                key={`${p.nome}-${p.cargo}`}
                nome={p.nome}
                detail={p.cargo}
                chips={
                  p.portaRecomendada
                    ? [{ label: COPY.portaRecomendada, emphasize: true }]
                    : []
                }
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function ApproachDoors({
  decisorNome,
  socios,
  enrichment,
}: {
  decisorNome: string | null | undefined;
  socios: PartnerCard[];
  enrichment: LeadEnrichment | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const others = socios.filter((s) => s.nome !== decisorNome);
  const people = enrichment?.people;
  const peopleExtracted = Array.isArray(people);
  const sitePeople: SitePerson[] = peopleExtracted ? people : [];
  const count = others.length + sitePeople.length;
  const hasRecommended = sitePeople.some((p) => p.portaRecomendada);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const t = event.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <FichaChip
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={COPY.outrasPortas}
        title={COPY.outrasPortas}
        active={open || hasRecommended}
        onClick={() => setOpen((v) => !v)}
      >
        <Users className="h-3.5 w-3.5" />
        {COPY.quadroReceita}
        {count > 0 ? <span className="tabular-nums">{count}</span> : null}
      </FichaChip>
      <AnchorPopover
        open={open}
        anchorRef={rootRef}
        panelRef={panelRef}
        id={panelId}
        className="w-80 p-3"
      >
        <DoorsList
          others={others}
          peopleExtracted={peopleExtracted}
          sitePeople={sitePeople}
          enrichment={enrichment}
        />
      </AnchorPopover>
    </div>
  );
}
