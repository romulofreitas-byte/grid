"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Users } from "lucide-react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import { yearsSince } from "@/lib/format";
import type { LeadEnrichment, PartnerCard, SitePerson } from "@/lib/types";
import { cn } from "@/lib/utils";

function socioLine(s: PartnerCard): string {
  const years = yearsSince(s.dataEntrada);
  const tenure = years != null ? ` · sócio há ${years} anos` : "";
  return `${s.qualificacao}${tenure}`;
}

function KindChip({
  children,
  emphasize = false,
}: {
  children: string;
  emphasize?: boolean;
}) {
  return (
    <Badge variant={emphasize ? "accent" : "neutral"} className="uppercase">
      {children}
    </Badge>
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
    <li className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm font-semibold text-podium-white">{nome}</p>
        {chips.map((c) => (
          <KindChip key={c.label} emphasize={c.emphasize}>
            {c.label}
          </KindChip>
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-podium-muted">
            Sócios (Receita)
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
      ) : (
        <p className="text-sm text-podium-muted">
          Nenhum outro sócio além do decisor no quadro.
        </p>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-podium-muted">
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

function useSociosParts(
  decisorNome: string | null | undefined,
  socios: PartnerCard[],
  enrichment: LeadEnrichment | null,
) {
  const others = socios.filter((s) => s.nome !== decisorNome);
  const people = enrichment?.people;
  const peopleExtracted = Array.isArray(people);
  const sitePeople: SitePerson[] = peopleExtracted ? people : [];
  const count = others.length + sitePeople.length;
  const hasRecommended = sitePeople.some((p) => p.portaRecomendada);
  return { others, peopleExtracted, sitePeople, count, hasRecommended };
}

/** Always-visible sócios block for the ficha (Wave 2). */
export function SociosPanel({
  decisorNome,
  socios,
  enrichment,
  className,
  embedded = false,
}: {
  decisorNome: string | null | undefined;
  socios: PartnerCard[];
  enrichment: LeadEnrichment | null;
  className?: string;
  embedded?: boolean;
}) {
  const { others, peopleExtracted, sitePeople } = useSociosParts(
    decisorNome,
    socios,
    enrichment,
  );

  const body = (
    <>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-podium-muted" aria-hidden />
        <h2 className="text-sm font-semibold text-podium-white">Sócios</h2>
      </div>
      <div className="mt-3">
        <DoorsList
          others={others}
          peopleExtracted={peopleExtracted}
          sitePeople={sitePeople}
          enrichment={enrichment}
        />
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          "mt-4 rounded-md border border-white/10 bg-white/[0.02] p-3",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <GlassCard className={cn("p-4 hover:translate-y-0", className)}>
      {body}
    </GlassCard>
  );
}

/** Compact popover trigger — kept for surfaces that still need a chip. */
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
  const { others, peopleExtracted, sitePeople, count, hasRecommended } =
    useSociosParts(decisorNome, socios, enrichment);

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
      <Button
        size="sm"
        variant={open || hasRecommended ? "secondary" : "ghost"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Sócios e nomes no site"
        title="Sócios e nomes no site"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <Users className="h-3.5 w-3.5" />
        Sócios
        {count > 0 ? <span className="tabular-nums">{count}</span> : null}
      </Button>
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
