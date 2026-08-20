"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { AuditLogo } from "@/components/AuditLogo";
import { FichaChip } from "@/components/FichaChip";
import { GlassCard } from "@/components/GlassCard";
import { SectionTitle } from "@/components/SectionTitle";
import {
  AUDIT_GROUPS,
  buildAuditSignals,
  defaultAuditSelection,
  emptyAuditSignals,
  isAuditGap,
  isAuditLive,
  scanningSignalIds,
  type AuditSignal,
} from "@/lib/audit/signals";
import { ENRICH_CREDIT_COST } from "@/lib/billing/catalog";
import { COPY } from "@/lib/copy";
import { enrichmentStage } from "@/lib/enrichment/fresh";
import { liveArrivalLine } from "@/lib/market/arrival";
import type { LeadDossier, LeadEnrichment } from "@/lib/types";
import { cn } from "@/lib/utils";

type GoldenMinute = LeadDossier["goldenMinute"];

function QualifyHeader({ mapsUrl }: { mapsUrl?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
          Qualificação
        </p>
        <SectionTitle className="mt-1 text-base md:text-base">Ativos digitais</SectionTitle>
      </div>
      {mapsUrl ? (
        <FichaChip as="a" href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin className="h-3.5 w-3.5" />
          Maps
        </FichaChip>
      ) : null}
    </div>
  );
}

function CompactTrail({
  enrichment,
  qualifying,
}: {
  enrichment: LeadEnrichment | null;
  qualifying: boolean;
}) {
  const line = liveArrivalLine(enrichment, qualifying);
  if (!line) return null;
  return (
    <p className="mt-4 flex items-center gap-2 text-sm font-bold text-podium-yellow">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-podium-yellow" />
      {line}
    </p>
  );
}

function GoldenFacts({ goldenMinute }: { goldenMinute: GoldenMinute | null }) {
  if (!goldenMinute || goldenMinute.facts.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
        O site mostrou
      </p>
      <ul className="mt-2 space-y-1 text-sm text-podium-gray">
        {goldenMinute.facts.slice(0, 3).map((f) => (
          <li key={f.phrase}>{f.phrase}</li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(
  signal: AuditSignal,
  scanning: boolean,
): { text: string; className: string } {
  if (scanning) {
    return { text: "Lendo", className: "text-podium-yellow" };
  }
  if (isAuditLive(signal)) {
    return { text: "Encontrado", className: "text-podium-success" };
  }
  if (isAuditGap(signal)) {
    return { text: "Falta", className: "text-amber-400" };
  }
  return { text: "Sem sinal", className: "text-podium-muted" };
}

function OpenLinks({
  signal,
  primary = false,
}: {
  signal: AuditSignal;
  primary?: boolean;
}) {
  const items = [
    ...(signal.href && signal.openLabel
      ? [{ href: signal.href, label: signal.openLabel }]
      : []),
    ...signal.links,
  ];
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((link, i) => (
          <FichaChip
            as="a"
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            active={primary && i === 0}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {link.label}
          </FichaChip>
      ))}
    </div>
  );
}

function SelectedSignalCard({
  signal,
  scanning,
  cardRef,
  siteDown,
  canConfirmSite,
  confirmPending,
  onConfirmSite,
  onRejectSite,
}: {
  signal: AuditSignal;
  scanning: boolean;
  cardRef?: Ref<HTMLDivElement>;
  siteDown?: boolean;
  canConfirmSite?: boolean;
  confirmPending?: boolean;
  onConfirmSite?: () => void;
  onRejectSite?: () => void;
}) {
  const status = statusLabel(signal, scanning);
  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-white/10 bg-podium-navy/50 p-4"
    >
      <div className="flex items-start gap-3">
        <AuditLogo
          logo={signal.logo}
          initials={signal.initials}
          accent={signal.accent}
          lit
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">{signal.name}</p>
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wide",
                status.className,
              )}
            >
              {status.text}
            </span>
          </div>
          {signal.href ? (
            <a
              href={signal.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-sm font-medium text-podium-yellow hover:underline"
            >
              {signal.value}
            </a>
          ) : (
            <p className="mt-1 break-all text-sm text-podium-gray">
              {signal.value}
            </p>
          )}
          {siteDown ? (
            <p className="mt-2 text-xs font-bold text-amber-400">
              Site fora do ar
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-snug text-podium-muted">
            {scanning ? "Cruzando este ativo agora." : signal.hint}
          </p>
          {signal.note ? (
            <p className="mt-2 text-xs leading-snug text-podium-muted">
              {signal.note}
            </p>
          ) : null}
          <OpenLinks signal={signal} primary />
          {canConfirmSite && onConfirmSite && onRejectSite ? (
            <p className="mt-2 text-[11px] leading-snug text-podium-muted">
              Ainda sem cruzamento.
              <button
                type="button"
                disabled={confirmPending}
                onClick={onConfirmSite}
                className="ml-2 font-bold text-podium-yellow hover:underline disabled:opacity-40"
              >
                {confirmPending ? "Atualizando…" : "É este"}
              </button>
              <button
                type="button"
                disabled={confirmPending}
                onClick={onRejectSite}
                className="ml-2 font-bold text-podium-gray hover:text-podium-yellow disabled:opacity-40"
              >
                Não é
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SignalTile({
  signal,
  selected,
  scanning,
  onSelect,
  reduce,
}: {
  signal: AuditSignal;
  selected: boolean;
  scanning: boolean;
  onSelect: () => void;
  reduce: boolean;
}) {
  const live = isAuditLive(signal);
  const gap = isAuditGap(signal);
  const status = statusLabel(signal, scanning);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-busy={scanning || undefined}
      onClick={onSelect}
      className={cn(
        "group box-border flex h-[7.25rem] w-full min-w-0 flex-col items-center justify-between rounded-2xl border px-1.5 py-2.5 text-center transition-[border-color,background-color] duration-300",
        selected
          ? "border-podium-yellow/50 bg-podium-yellow/10"
          : scanning
            ? "border-podium-yellow/40 bg-podium-yellow/[0.06]"
            : live
              ? "border-podium-yellow/25 bg-white/[0.04] hover:border-podium-yellow/40"
              : gap
                ? "border-amber-400/35 bg-amber-400/[0.06] hover:border-amber-400/50"
                : "border-white/[0.08] bg-white/[0.03] hover:border-white/15",
        scanning && !selected && !reduce && "audit-scan-pulse",
        gap && !scanning && !selected && !reduce && "audit-gap-pulse",
      )}
    >
      <AuditLogo
        logo={signal.logo}
        initials={signal.initials}
        accent={signal.accent}
        size="sm"
        lit={live || selected || scanning}
      />
      <span
        className={cn(
          "line-clamp-2 h-[2.5em] w-full text-[10px] font-bold leading-tight",
          selected || scanning
            ? "text-podium-yellow"
            : live
              ? "text-podium-gray"
              : gap
                ? "text-amber-300"
                : "text-podium-muted",
        )}
      >
        {signal.name}
      </span>
      <span
        className={cn(
          "h-3.5 shrink-0 text-[9px] font-bold uppercase leading-none tracking-wide",
          status.className,
        )}
      >
        {status.text}
      </span>
    </button>
  );
}

export function DigitalAuditPanel({
  enrichment,
  compact = false,
  qualifying = false,
  qualifyPending = false,
  qualifyError = null,
  onQualify,
  mapsUrl = null,
  goldenMinute = null,
  confirmPending = false,
  onConfirmSite,
  onRejectSite,
}: {
  enrichment: LeadEnrichment | null;
  compact?: boolean;
  qualifying?: boolean;
  qualifyPending?: boolean;
  qualifyError?: string | null;
  onQualify?: () => void;
  mapsUrl?: string | null;
  goldenMinute?: GoldenMinute | null;
  confirmPending?: boolean;
  onConfirmSite?: (domain: string) => void;
  onRejectSite?: (domain: string) => void;
}) {
  const reduce = useReducedMotion();
  const detailRef = useRef<HTMLDivElement>(null);
  const streaming = qualifying || qualifyPending;
  const complete =
    enrichment != null && enrichmentStage(enrichment) === "complete";
  const signals = useMemo(
    () => (enrichment ? buildAuditSignals(enrichment) : emptyAuditSignals()),
    [enrichment],
  );
  const scanningIds = useMemo(() => {
    const ids = scanningSignalIds(
      enrichment ? enrichmentStage(enrichment) : null,
      streaming && !complete,
      enrichment,
    );
    return new Set(
      ids.filter((id) => {
        const signal = signals.find((s) => s.id === id);
        return signal ? !isAuditLive(signal) : true;
      }),
    );
  }, [enrichment, streaming, complete, signals]);
  const auditKey = enrichment
    ? `${enrichment.cnpj}:${enrichment.collected_at}`
    : "pending";
  const [selectedId, setSelectedId] = useState(() =>
    defaultAuditSelection(signals),
  );
  const [logosOpen, setLogosOpen] = useState(!compact);

  useEffect(() => {
    setSelectedId(defaultAuditSelection(signals));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when auditKey changes
  }, [auditKey]);

  function pickSignal(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
      });
    });
  }

  const selected =
    signals.find((s) => s.id === selectedId) ?? signals[0] ?? null;
  const tileTransition = reduce
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };
  const showBoard = !compact || logosOpen;
  const showQualifyCta = Boolean(onQualify) && !streaming && !complete;
  const siteDown =
    enrichment != null &&
    enrichment.domain != null &&
    enrichment.http_status != null &&
    enrichment.http_status >= 400;
  const canConfirmSite =
    Boolean(onConfirmSite && onRejectSite && enrichment?.domain) &&
    complete &&
    !streaming &&
    enrichment?.domain_status === "nao_confirmado";

  return (
    <GlassCard className="p-5 hover:translate-y-0">
      <QualifyHeader mapsUrl={mapsUrl} />
      {showQualifyCta ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-podium-gray">
            {COPY.qualificarFichaLead}
          </p>
          {qualifyError ? (
            <p className="mt-3 text-sm text-amber-400">{qualifyError}</p>
          ) : null}
          <button
            type="button"
            disabled={qualifyPending}
            onClick={onQualify}
            className="mt-4 w-full rounded-xl bg-podium-yellow px-4 py-3 text-sm font-extrabold text-podium-navy disabled:opacity-40"
          >
            {qualifyPending
              ? "Qualificando…"
              : `${COPY.qualificarEstaEmpresa} · ${ENRICH_CREDIT_COST} créditos`}
          </button>
        </>
      ) : null}
      {(streaming || (enrichment && !complete)) && (
        <CompactTrail
          enrichment={enrichment}
          qualifying={streaming || !complete}
        />
      )}
      {complete ? <GoldenFacts goldenMinute={goldenMinute} /> : null}

      {selected && showBoard ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-podium-muted">
            Em foco
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
            >
              <SelectedSignalCard
                signal={selected}
                scanning={scanningIds.has(selected.id)}
                cardRef={detailRef}
                siteDown={selected.id === "site" && siteDown}
                canConfirmSite={selected.id === "site" && canConfirmSite}
                confirmPending={confirmPending}
                onConfirmSite={
                  enrichment?.domain && onConfirmSite
                    ? () => onConfirmSite(enrichment.domain!)
                    : undefined
                }
                onRejectSite={
                  enrichment?.domain && onRejectSite
                    ? () => onRejectSite(enrichment.domain!)
                    : undefined
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {compact ? (
        <button
          type="button"
          onClick={() => setLogosOpen((open) => !open)}
          className="mt-4 text-xs font-bold text-podium-yellow hover:underline"
        >
          {logosOpen ? "Recolher cards" : "Ver cards dos ativos"}
        </button>
      ) : null}

      {showBoard &&
        AUDIT_GROUPS.map((group) => {
          const items = signals.filter((s) => s.group === group.id);
          return (
            <section key={group.id} className="mt-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                <span className="inline-block h-4 w-0.5 rounded-sm bg-podium-yellow" />
                {group.label}
              </h3>
              <p className="mt-1 text-xs text-podium-muted">{group.hint}</p>
              <div className="mt-3 grid grid-cols-4 gap-2 [grid-template-columns:repeat(4,minmax(0,1fr))]">
                {items.map((signal, index) => (
                  <motion.div
                    key={signal.id}
                    className="min-w-0"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...tileTransition,
                      delay: reduce ? 0 : index * 0.03,
                    }}
                  >
                    <SignalTile
                      signal={signal}
                      selected={selectedId === signal.id}
                      scanning={scanningIds.has(signal.id)}
                      onSelect={() => pickSignal(signal.id)}
                      reduce={Boolean(reduce)}
                    />
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
    </GlassCard>
  );
}
