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
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
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

export function ApproachDoors({
  decisorNome,
  socios,
  enrichment,
}: {
  decisorNome: string | null | undefined;
  socios: PartnerCard[];
  enrichment: LeadEnrichment | null;
}) {
  const others = socios.filter((s) => s.nome !== decisorNome);
  const people = enrichment?.people;
  const peopleExtracted = Array.isArray(people);
  const sitePeople: SitePerson[] = peopleExtracted ? people : [];

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-xs uppercase tracking-wide text-podium-gray">
        {COPY.outrasPortas}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-podium-muted">
        {COPY.outrasPortasHint}
      </p>

      {others.length > 0 ? (
        <div className="mt-3">
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

      <div className="mt-3">
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
    </div>
  );
}
