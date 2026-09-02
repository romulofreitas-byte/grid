"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { AuditLogo } from "@/components/AuditLogo";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/GlassCard";
import { SectionTitle } from "@/components/SectionTitle";
import {
  AUDIT_GROUPS,
  buildAuditSignals,
  defaultAuditSelection,
  emptyAuditSignals,
  isAuditGap,
  isAuditLive,
  isSiteOffline,
  qualifyChipKind,
  scanningSignalIds,
  type AuditSignal,
  type QualifyChipKind,
} from "@/lib/audit/signals";
import { ENRICH_CREDIT_COST } from "@/lib/billing/catalog";
import { COPY } from "@/lib/copy";
import type { PresenceCorrection } from "@/lib/enrichment/correct-presence";
import { companySiteLabel, homepagePathOf } from "@/lib/enrichment/company-site";
import { enrichmentStage } from "@/lib/enrichment/fresh";
import { liveArrivalLine } from "@/lib/market/arrival";
import type { LeadEnrichment } from "@/lib/types";
import { cn } from "@/lib/utils";

function qualifyChipCopy(kind: QualifyChipKind): { text: string; className: string } {
  if (kind === "qualificando") {
    return { text: COPY.fichaQualifyScanning, className: "text-podium-yellow" };
  }
  if (kind === "oportunidade") {
    return {
      text: COPY.landingQualifyOpportunity,
      className: "text-amber-300",
    };
  }
  return { text: COPY.fichaQualifyQualified, className: "text-podium-success" };
}

function QualifyHeader({
  mapsUrl,
  showRefresh,
  refreshing,
  onRefresh,
  chip,
}: {
  mapsUrl?: string | null;
  showRefresh?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  chip?: QualifyChipKind | null;
}) {
  const chipCopy = chip ? qualifyChipCopy(chip) : null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Qualificação
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SectionTitle className="text-base md:text-base">
            Ativos digitais
          </SectionTitle>
          {chipCopy ? (
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.14em]",
                chipCopy.className,
              )}
            >
              {chipCopy.text}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {showRefresh && onRefresh ? (
          <button
            type="button"
            title={COPY.atualizarQualificacaoHint}
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[11px] font-medium text-podium-muted transition hover:bg-white/5 hover:text-podium-gray disabled:opacity-50"
          >
            {refreshing
              ? COPY.atualizandoQualificacao
              : `${COPY.atualizarQualificacao} · ${ENRICH_CREDIT_COST}`}
          </button>
        ) : null}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-podium-muted transition hover:bg-white/5 hover:text-podium-gray"
          >
            <MapPin className="h-3.5 w-3.5" />
            Maps
          </a>
        ) : null}
      </div>
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

type SealKind = "live" | "gap" | "pending" | "scanning" | "unverified";

function assetSeal(
  signal: AuditSignal,
  scanning: boolean,
): { text: string; kind: SealKind } {
  if (scanning) {
    return { text: COPY.fichaSealScanning, kind: "scanning" };
  }
  const tools = signal.group === "ferramentas";
  if (isAuditLive(signal)) {
    if (tools) return { text: COPY.fichaSealToolLive, kind: "live" };
    if (signal.id === "site") return { text: COPY.fichaSealLiveSite, kind: "live" };
    if (signal.id === "gmb" || signal.id === "atualizacao") {
      return { text: COPY.fichaSealLiveGoogle, kind: "live" };
    }
    return { text: COPY.fichaSealLiveSocial, kind: "live" };
  }
  if (signal.found && signal.unverified) {
    return { text: COPY.fichaSealUnverified, kind: "unverified" };
  }
  if (isAuditGap(signal)) {
    if (tools) return { text: COPY.fichaSealToolMissing, kind: "gap" };
    return { text: COPY.landingQualifyMissingSeal, kind: "gap" };
  }
  return { text: COPY.fichaSealPending, kind: "pending" };
}

function SealPill({
  signal,
  scanning,
  compact = false,
}: {
  signal: AuditSignal;
  scanning: boolean;
  compact?: boolean;
}) {
  const seal = assetSeal(signal, scanning);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full font-bold uppercase tracking-[0.1em]",
        compact ? "max-w-full truncate px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]",
        seal.kind === "live" && "bg-podium-success/15 text-podium-success",
        seal.kind === "gap" && "bg-amber-400/15 text-amber-300",
        (seal.kind === "scanning" || seal.kind === "unverified") &&
          "bg-podium-yellow/15 text-podium-yellow",
        seal.kind === "pending" && "bg-white/10 text-podium-muted",
      )}
    >
      {seal.text}
    </span>
  );
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
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition",
            primary && i === 0
              ? "border-white/20 bg-white/[0.06] text-podium-white"
              : "border-white/10 text-podium-muted hover:border-white/20 hover:text-podium-gray",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {link.label}
        </a>
      ))}
    </div>
  );
}

const EDITABLE_PRESENCE = new Set([
  "site",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "gmb",
  "whatsapp",
]);

type EditablePresenceId =
  | "site"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "gmb"
  | "whatsapp";

const PRESENCE_PLACEHOLDER: Record<EditablePresenceId, string> = {
  site: "domínio ou URL do site",
  instagram: "URL ou @usuario",
  facebook: "URL do Facebook",
  linkedin: "URL do LinkedIn",
  youtube: "URL do YouTube",
  gmb: "URL do Google Meu Negócio",
  whatsapp: "telefone ou wa.me",
};

function isEditablePresence(id: string): id is EditablePresenceId {
  return EDITABLE_PRESENCE.has(id);
}

function presenceSeed(
  id: EditablePresenceId,
  enrichment: LeadEnrichment | null,
): string {
  if (!enrichment) return "";
  if (id === "site") {
    return (
      companySiteLabel(enrichment.domain, homepagePathOf(enrichment)) ?? ""
    );
  }
  if (id === "instagram") return enrichment.socials.instagram ?? "";
  if (id === "facebook") return enrichment.socials.facebook ?? "";
  if (id === "linkedin") return enrichment.socials.linkedin ?? "";
  if (id === "youtube") return enrichment.socials.youtube ?? "";
  if (id === "gmb") return enrichment.gmb?.matched ? enrichment.gmb.url : "";
  return enrichment.whatsapp ?? "";
}

function toPresenceCorrection(
  id: EditablePresenceId,
  value: string | null,
): PresenceCorrection {
  if (id === "site") return { domain: value };
  return { [id]: value };
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
  canCorrect,
  correctPending,
  correctError,
  editSeed,
  onCorrect,
}: {
  signal: AuditSignal;
  scanning: boolean;
  cardRef?: Ref<HTMLDivElement>;
  siteDown?: boolean;
  canConfirmSite?: boolean;
  confirmPending?: boolean;
  onConfirmSite?: () => void;
  onRejectSite?: () => void;
  canCorrect?: boolean;
  correctPending?: boolean;
  correctError?: string | null;
  editSeed?: string;
  onCorrect?: (corrections: PresenceCorrection) => void;
}) {
  const field =
    canCorrect && onCorrect && isEditablePresence(signal.id) ? signal.id : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editSeed ?? "");
  const pendingRef = useRef(false);

  useEffect(() => {
    setEditing(false);
    setDraft(editSeed ?? "");
  }, [signal.id, editSeed]);

  useEffect(() => {
    if (pendingRef.current && !correctPending && !correctError) {
      setEditing(false);
    }
    pendingRef.current = Boolean(correctPending);
  }, [correctPending, correctError]);
  return (
    <div
      ref={cardRef}
      className="rounded-lg border border-white/10 bg-podium-navy/50 p-4"
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
            <p className="text-sm font-semibold">{signal.name}</p>
            <SealPill signal={signal} scanning={scanning} />
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
          {signal.id === "atualizacao" && signal.hint ? (
            <p className="mt-2 text-xs leading-snug text-podium-muted">
              {signal.hint}
            </p>
          ) : null}
          {signal.note ? (
            <p className="mt-2 text-xs leading-snug text-podium-muted">
              {signal.note}
            </p>
          ) : null}
          <OpenLinks signal={signal} primary />
          {canConfirmSite && onConfirmSite && onRejectSite ? (
            <p className="mt-2 text-[11px] leading-snug text-podium-muted">
              Site ainda não confirmado.
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
          {field ? (
            editing ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const value = draft.trim();
                  if (!value) return;
                  onCorrect?.(toPresenceCorrection(field, value));
                }}
              >
                <input
                  value={draft}
                  onChange={(ev) => setDraft(ev.target.value)}
                  placeholder={PRESENCE_PLACEHOLDER[field]}
                  disabled={correctPending}
                  className="h-9 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-podium-white placeholder:text-podium-muted focus:border-podium-yellow/50 focus:outline-none focus:ring-2 focus:ring-podium-yellow/30 disabled:opacity-50"
                />
                <p className="text-[11px] leading-snug text-podium-muted">
                  {COPY.corrigirQualificacaoHint}
                </p>
                {correctError ? (
                  <p className="text-xs text-amber-400">{correctError}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={correctPending || !draft.trim()}
                    className="text-xs font-bold text-podium-yellow hover:underline disabled:opacity-40"
                  >
                    {correctPending ? "Salvando…" : COPY.salvarQualificacao}
                  </button>
                  {isAuditLive(signal) || signal.found ? (
                    <button
                      type="button"
                      disabled={correctPending}
                      onClick={() =>
                        onCorrect?.(toPresenceCorrection(field, null))
                      }
                      className="text-xs font-bold text-podium-gray hover:text-podium-yellow disabled:opacity-40"
                    >
                      {COPY.limparQualificacao}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={correctPending}
                    onClick={() => {
                      setEditing(false);
                      setDraft(editSeed ?? "");
                    }}
                    className="text-xs font-semibold text-podium-muted hover:text-podium-gray disabled:opacity-40"
                  >
                    {COPY.cancelarQualificacao}
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-podium-muted">
                <button
                  type="button"
                  disabled={correctPending}
                  onClick={() => setEditing(true)}
                  className="font-bold text-podium-yellow hover:underline disabled:opacity-40"
                >
                  {signal.found ? COPY.corrigirQualificacao : COPY.inserirQualificacao}
                </button>
              </p>
            )
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
  const presenceGap = isAuditGap(signal) && signal.group === "presenca";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-busy={scanning || undefined}
      onClick={onSelect}
      className={cn(
        "group box-border flex h-[7.5rem] w-full min-w-0 flex-col items-center justify-between rounded-lg border px-1.5 py-2.5 text-center transition-[border-color,background-color,box-shadow] duration-300",
        selected
          ? "border-podium-yellow/50 bg-podium-yellow/10 shadow-[inset_0_0_0_1px_rgba(245,179,1,0.15)]"
          : scanning
            ? "border-podium-yellow/40 bg-podium-yellow/[0.06]"
            : live
              ? "border-podium-success/45 bg-podium-success/10 hover:border-podium-success/60"
              : presenceGap
                ? "border-amber-400/50 bg-amber-400/10 hover:border-amber-400/70"
                : "border-dashed border-white/15 bg-transparent hover:border-white/25",
        scanning && !selected && !reduce && "audit-scan-pulse",
        presenceGap && !scanning && !selected && !reduce && "audit-gap-pulse",
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
          "line-clamp-2 h-[2.5em] w-full text-[10px] font-medium leading-tight",
          selected || scanning
            ? "text-podium-yellow"
            : live
              ? "text-podium-white"
              : presenceGap
                ? "text-amber-200"
                : "text-podium-muted",
        )}
      >
        {signal.name}
      </span>
      <SealPill signal={signal} scanning={scanning} compact />
    </button>
  );
}

function SignalTileGrid({
  items,
  selectedId,
  scanningIds,
  pickSignal,
  reduce,
  tileTransition,
}: {
  items: AuditSignal[];
  selectedId: string | null;
  scanningIds: Set<string>;
  pickSignal: (id: string) => void;
  reduce: boolean | null;
  tileTransition: {
    duration: number;
    ease?: readonly [number, number, number, number];
  };
}) {
  if (items.length === 0) return null;
  return (
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
  );
}

export function DigitalAuditPanel({
  enrichment,
  compact = false,
  qualifying = false,
  refreshing = false,
  qualifyPending = false,
  qualifyError = null,
  onQualify,
  onRefresh,
  mapsUrl = null,
  confirmPending = false,
  onConfirmSite,
  onRejectSite,
  correctPending = false,
  correctError = null,
  onCorrectPresence,
  className,
}: {
  enrichment: LeadEnrichment | null;
  compact?: boolean;
  qualifying?: boolean;
  /** Paid re-run of an already-complete audit — keep prior result visible. */
  refreshing?: boolean;
  qualifyPending?: boolean;
  qualifyError?: string | null;
  onQualify?: () => void;
  onRefresh?: () => void;
  mapsUrl?: string | null;
  confirmPending?: boolean;
  onConfirmSite?: (domain: string) => void;
  onRejectSite?: (domain: string) => void;
  correctPending?: boolean;
  correctError?: string | null;
  onCorrectPresence?: (corrections: PresenceCorrection) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const detailRef = useRef<HTMLDivElement>(null);
  const firstRunStreaming = (qualifying || qualifyPending) && !refreshing;
  const complete =
    enrichment != null && enrichmentStage(enrichment) === "complete";
  const signals = useMemo(
    () => (enrichment ? buildAuditSignals(enrichment) : emptyAuditSignals()),
    [enrichment],
  );
  const scanningIds = useMemo(() => {
    const ids = scanningSignalIds(
      enrichment ? enrichmentStage(enrichment) : null,
      firstRunStreaming && !complete,
      enrichment,
    );
    return new Set(
      ids.filter((id) => {
        const signal = signals.find((s) => s.id === id);
        return signal ? !isAuditLive(signal) : true;
      }),
    );
  }, [enrichment, firstRunStreaming, complete, signals]);
  const auditKey = enrichment
    ? `${enrichment.cnpj}:${enrichment.collected_at}`
    : "pending";
  const [selectedId, setSelectedId] = useState(() =>
    defaultAuditSelection(signals),
  );
  const [logosOpen, setLogosOpen] = useState(!compact);
  const [toolsMissingOpen, setToolsMissingOpen] = useState(false);

  useEffect(() => {
    setSelectedId(defaultAuditSelection(signals));
    setToolsMissingOpen(false);
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
  // First-time only — never replace a completed audit with the Qualificar CTA.
  const showQualifyCta =
    Boolean(onQualify) && !onRefresh && !firstRunStreaming && !complete;
  // Always keep Atualizar when the parent offers it (completed audit).
  const showRefresh = Boolean(onRefresh);
  const awaitingAudit =
    !enrichment && !firstRunStreaming && !showQualifyCta && !refreshing;
  /** Empty CTA: show Presença tiles as preview; Ferramentas wait until audit starts. */
  const previewPresence = showQualifyCta;
  const auditActive = Boolean(enrichment || firstRunStreaming || refreshing);
  const showBoard =
    (previewPresence || auditActive) && (!compact || logosOpen);
  const showTools = auditActive;
  const siteDown = enrichment != null && isSiteOffline(enrichment);
  const canConfirmSite =
    Boolean(onConfirmSite && onRejectSite && enrichment?.domain) &&
    complete &&
    !firstRunStreaming &&
    !refreshing &&
    enrichment?.domain_status === "nao_confirmado";
  const canCorrect =
    Boolean(onCorrectPresence) &&
    complete &&
    !firstRunStreaming &&
    !refreshing;
  const chip = qualifyChipKind(signals, {
    scanning: firstRunStreaming && !complete,
    complete,
  });

  return (
    <GlassCard className={cn("p-5 hover:translate-y-0", className)}>
      <QualifyHeader
        mapsUrl={mapsUrl}
        showRefresh={showRefresh}
        refreshing={refreshing || (Boolean(onRefresh) && qualifyPending)}
        onRefresh={onRefresh}
        chip={chip}
      />
      {showQualifyCta ? (
        <>
          <p className="mt-3 text-sm text-podium-muted">
            {COPY.qualificarFichaLead}
          </p>
          {qualifyError ? (
            <p className="mt-3 text-sm text-amber-400">{qualifyError}</p>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            disabled={qualifyPending}
            onClick={onQualify}
            title={COPY.qualificarFichaLeadHint}
            className="mt-4 w-full"
          >
            {qualifyPending
              ? "Qualificando…"
              : `${COPY.qualificar} · ${ENRICH_CREDIT_COST} créditos`}
          </Button>
        </>
      ) : null}
      {qualifyError && !showQualifyCta ? (
        <p className="mt-3 text-sm text-amber-400">{qualifyError}</p>
      ) : null}
      {refreshing ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-podium-yellow">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-podium-yellow" />
          {COPY.atualizandoQualificacao} Mantendo o resultado atual até terminar.
        </p>
      ) : null}
      {awaitingAudit ? (
        <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-podium-gray">
          Site, redes e Google desta empresa ainda não foram buscados. A ordem da
          lista usa só o cadastro da Receita até você qualificar.
        </p>
      ) : null}
      {(firstRunStreaming || (enrichment && !complete && !refreshing)) && (
        <CompactTrail
          enrichment={enrichment}
          qualifying={firstRunStreaming || !complete}
        />
      )}

      {selected && showBoard && !previewPresence ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-podium-muted">
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
                canCorrect={canCorrect}
                correctPending={correctPending}
                correctError={correctError}
                editSeed={
                  isEditablePresence(selected.id)
                    ? presenceSeed(selected.id, enrichment)
                    : ""
                }
                onCorrect={onCorrectPresence}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {compact ? (
        <button
          type="button"
          onClick={() => setLogosOpen((open) => !open)}
          className="mt-4 text-xs font-semibold text-podium-muted hover:text-podium-yellow hover:underline"
        >
          {logosOpen ? "Recolher cards" : "Ver cards dos ativos"}
        </button>
      ) : null}

      {showBoard &&
        AUDIT_GROUPS.map((group) => {
          if (group.id === "ferramentas" && !showTools) return null;
          const items = signals.filter((s) => s.group === group.id);
          if (group.id !== "ferramentas") {
            return (
              <section key={group.id} className="mt-5">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                  <span className="inline-block h-4 w-0.5 rounded-sm bg-podium-yellow" />
                  {group.label}
                </h3>
                {!previewPresence ? (
                  <p className="mt-1 text-xs text-podium-muted">{group.hint}</p>
                ) : null}
                <SignalTileGrid
                  items={items}
                  selectedId={selectedId}
                  scanningIds={scanningIds}
                  pickSignal={pickSignal}
                  reduce={reduce}
                  tileTransition={tileTransition}
                />
              </section>
            );
          }

          const found = items.filter(
            (s) => isAuditLive(s) || scanningIds.has(s.id),
          );
          const missing = items.filter(
            (s) => !isAuditLive(s) && !scanningIds.has(s.id),
          );

          return (
            <section key={group.id} className="mt-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                <span className="inline-block h-4 w-0.5 rounded-sm bg-podium-yellow" />
                {group.label}
              </h3>
              <p className="mt-1 text-xs text-podium-muted">{group.hint}</p>
              <SignalTileGrid
                items={found}
                selectedId={selectedId}
                scanningIds={scanningIds}
                pickSignal={pickSignal}
                reduce={reduce}
                tileTransition={tileTransition}
              />
              {found.length === 0 && missing.length > 0 && !toolsMissingOpen ? (
                <p className="mt-3 text-xs text-podium-muted">
                  Nenhuma ferramenta encontrada ainda.
                </p>
              ) : null}
              {missing.length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    aria-expanded={toolsMissingOpen}
                    onClick={() => setToolsMissingOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-dashed border-white/15 px-3 py-2 text-left text-podium-muted hover:border-white/25 hover:text-podium-gray"
                  >
                    <span className="text-xs font-medium">
                      {toolsMissingOpen
                        ? "Recolher"
                        : `Ver ${missing.length} ferramenta${missing.length === 1 ? "" : "s"} não encontrada${missing.length === 1 ? "" : "s"}`}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition",
                        toolsMissingOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {toolsMissingOpen ? (
                    <SignalTileGrid
                      items={missing}
                      selectedId={selectedId}
                      scanningIds={scanningIds}
                      pickSignal={pickSignal}
                      reduce={reduce}
                      tileTransition={tileTransition}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
    </GlassCard>
  );
}
