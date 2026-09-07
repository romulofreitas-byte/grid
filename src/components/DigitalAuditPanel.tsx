"use client";

import { useReducedMotion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { AuditLogo } from "@/components/AuditLogo";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/GlassCard";
import {
  AUDIT_GROUPS,
  buildAuditSignals,
  defaultAuditSelection,
  emptyAuditSignals,
  isAuditGap,
  isAuditLive,
  isAuditCandidate,
  isSiteOffline,
  qualifyChipKind,
  scanningSignalIds,
  type AuditSignal,
  type QualifyChipKind,
} from "@/lib/audit/signals";
import { GRID_PRESENCE_IDS } from "@/lib/audit/grid-presence";
import { ENRICH_CREDIT_COST, creditsPhrase } from "@/lib/billing/catalog";
import { COPY } from "@/lib/copy";
import { mapsPinConfirmable, type PresenceCorrection } from "@/lib/enrichment/correct-presence";
import { companySiteLabel, homepagePathOf } from "@/lib/enrichment/company-site";
import { enrichmentStage } from "@/lib/enrichment/fresh";
import { liveArrivalLine } from "@/lib/market/arrival";
import { gmbListingIsCandidate, type LeadEnrichment } from "@/lib/types";
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
  showRefresh,
  refreshing,
  onRefresh,
  chip,
  action,
}: {
  showRefresh?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  chip?: QualifyChipKind | null;
  action?: ReactNode;
}) {
  const chipCopy = chip ? qualifyChipCopy(chip) : null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Qualificação
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-podium-white">Ativos</h2>
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
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {showRefresh && onRefresh ? (
          <button
            type="button"
            title={COPY.atualizarQualificacaoHint}
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex h-8 shrink-0 items-center rounded-md px-2 text-[11px] font-medium text-podium-muted transition hover:bg-white/5 hover:text-podium-gray disabled:opacity-50"
          >
            {refreshing
              ? COPY.atualizandoQualificacao
              : `${COPY.atualizarQualificacao} · ${creditsPhrase(ENRICH_CREDIT_COST)}`}
          </button>
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
    <p className="mt-2 flex items-center gap-2 text-xs font-bold text-podium-yellow">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-podium-yellow" />
      {line}
    </p>
  );
}

type SealKind = "live" | "gap" | "pending" | "scanning" | "unverified" | "candidate";

function assetSeal(
  signal: AuditSignal,
  scanning: boolean,
): { text: string; kind: SealKind } {
  if (scanning) {
    return { text: COPY.fichaSealScanning, kind: "scanning" };
  }
  const tools = signal.group === "ferramentas";
  if (isAuditLive(signal)) {
    if (signal.sealLabel) {
      return {
        text: signal.sealLabel,
        kind: signal.sealKind ?? "live",
      };
    }
    if (tools) return { text: COPY.fichaSealToolLive, kind: "live" };
    if (signal.id === "site") return { text: COPY.fichaSealLiveSite, kind: "live" };
    if (signal.id === "maps") return { text: COPY.fichaSealMapsLive, kind: "live" };
    if (signal.id === "gmb" || signal.id === "atualizacao") {
      return { text: COPY.fichaSealLiveGoogle, kind: "live" };
    }
    return { text: COPY.fichaSealLiveSocial, kind: "live" };
  }
  if (isAuditCandidate(signal)) {
    return { text: COPY.fichaSealUnverified, kind: "candidate" };
  }
  if (signal.unverified && signal.sealKind === "unverified") {
    return {
      text: signal.sealLabel ?? COPY.fichaSealUnverified,
      kind: "unverified",
    };
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
        (seal.kind === "candidate" || seal.kind === "unverified") &&
          "bg-podium-yellow/15 text-podium-yellow",
        seal.kind === "gap" && "bg-white/10 text-podium-muted",
        seal.kind === "scanning" && "bg-podium-yellow/15 text-podium-yellow",
        seal.kind === "pending" && "bg-white/10 text-podium-muted",
      )}
    >
      {seal.text}
    </span>
  );
}

const actionChip =
  "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition disabled:opacity-40";
const confirmChip =
  "border-podium-yellow/55 text-podium-yellow hover:border-podium-yellow hover:bg-podium-yellow/10";
const rejectChip =
  "border-white/15 text-podium-gray hover:border-white/25 hover:text-podium-white";

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
    <>
      {items.map((link, i) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            actionChip,
            primary && i === 0
              ? "border-white/20 bg-white/[0.06] text-podium-white"
              : "border-white/10 font-medium text-podium-muted hover:border-white/20 hover:text-podium-gray",
          )}
        >
          <ExternalLink className="h-3 w-3" />
          {link.label}
        </a>
      ))}
    </>
  );
}

const EDITABLE_PRESENCE = new Set([
  "site",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "maps",
  "whatsapp",
]);

type EditablePresenceId =
  | "site"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "maps"
  | "whatsapp";

const PRESENCE_PLACEHOLDER: Record<EditablePresenceId, string> = {
  site: "domínio ou URL do site",
  instagram: "URL ou @usuario",
  facebook: "URL do Facebook",
  linkedin: "URL do LinkedIn",
  youtube: "URL do YouTube",
  maps: "URL do Google Maps",
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
  if (id === "maps") {
    const listing = enrichment.gmb;
    if (!listing) return "";
    if (listing.matched || gmbListingIsCandidate(listing)) return listing.url;
    return "";
  }
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
  canConfirmMapsPin,
  canRejectMaps,
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
  canConfirmMapsPin?: boolean;
  canRejectMaps?: boolean;
}) {
  const field =
    canCorrect && onCorrect && isEditablePresence(signal.id) ? signal.id : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editSeed ?? "");
  const pendingRef = useRef(false);
  const confirmSite = Boolean(canConfirmSite && onConfirmSite && onRejectSite);
  const confirmMaps = Boolean(
    onCorrect && (canConfirmMapsPin || canRejectMaps),
  );
  const busy = Boolean(confirmPending || correctPending);
  const hasOpenLinks =
    Boolean(signal.href && signal.openLabel) || signal.links.length > 0;
  const showActionRow =
    hasOpenLinks || confirmSite || confirmMaps || Boolean(field);
  const needsActionHint =
    !scanning &&
    (isAuditCandidate(signal) ||
      isAuditGap(signal) ||
      Boolean(signal.unverified) ||
      confirmSite ||
      confirmMaps);

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
    <div ref={cardRef} className="min-w-0">
      <div className="flex items-start gap-2">
        <AuditLogo
          logo={signal.logo}
          initials={signal.initials}
          accent={signal.accent}
          size="sm"
          lit
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold">{signal.name}</p>
            <SealPill compact signal={signal} scanning={scanning} />
          </div>
          {signal.href ? (
            <a
              href={signal.href}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate text-xs font-medium text-podium-yellow hover:underline"
            >
              {signal.value}
            </a>
          ) : (
            <p className="mt-0.5 truncate text-xs text-podium-gray">
              {signal.value}
            </p>
          )}
          {siteDown ? (
            <p className="mt-1 text-[11px] font-bold text-amber-400">
              Site fora do ar
            </p>
          ) : null}
          {needsActionHint && signal.hint ? (
            <p className="mt-1 text-[11px] leading-snug text-podium-muted">
              {signal.hint}
            </p>
          ) : null}
          {signal.note && !isAuditLive(signal) && !scanning ? (
            <p className="mt-1 text-[11px] leading-snug text-podium-muted">
              {signal.note}
            </p>
          ) : null}
          {editing && field ? (
            <form
              className="mt-1.5 space-y-1.5"
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
                className="h-8 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-sm text-podium-white placeholder:text-podium-muted focus:border-podium-yellow/50 focus:outline-none focus:ring-2 focus:ring-podium-yellow/30 disabled:opacity-50"
              />
              <p className="text-[10px] leading-snug text-podium-muted">
                {COPY.corrigirQualificacaoHint}
              </p>
              {correctError ? (
                <p className="text-xs text-amber-400">{correctError}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={correctPending || !draft.trim()}
                  className="text-[11px] font-bold text-podium-yellow hover:underline disabled:opacity-40"
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
                    className="text-[11px] font-bold text-podium-gray hover:text-podium-yellow disabled:opacity-40"
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
                  className="text-[11px] font-semibold text-podium-muted hover:text-podium-gray disabled:opacity-40"
                >
                  {COPY.cancelarQualificacao}
                </button>
              </div>
            </form>
          ) : (
            <>
              {showActionRow ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <OpenLinks signal={signal} primary />
                {confirmSite ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onConfirmSite}
                      className={cn(actionChip, confirmChip)}
                    >
                      {confirmPending ? "Atualizando…" : "É este"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onRejectSite}
                      className={cn(actionChip, rejectChip)}
                    >
                      Não é
                    </button>
                  </>
                ) : null}
                {confirmMaps ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        canConfirmMapsPin || !signal.href
                          ? onCorrect?.({ confirmMaps: true })
                          : onCorrect?.({ maps: signal.href })
                      }
                      className={cn(actionChip, confirmChip)}
                    >
                      {correctPending
                        ? "Atualizando…"
                        : COPY.fichaMapsConfirmThis}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onCorrect?.({ maps: null })}
                      className={cn(actionChip, rejectChip)}
                    >
                      {COPY.fichaMapsRejectThis}
                    </button>
                  </>
                ) : null}
                {field ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                    className="text-[10px] font-bold text-podium-yellow hover:underline disabled:opacity-40"
                  >
                    {signal.found
                      ? COPY.corrigirQualificacao
                      : COPY.inserirQualificacao}
                  </button>
                ) : null}
                </div>
              ) : null}
              {correctError ? (
                <p className="mt-1 text-xs text-amber-400">{correctError}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function presenceConfirm(signal: AuditSignal): boolean {
  return isAuditCandidate(signal) || signal.sealKind === "unverified";
}

function PresenceIconButton({
  signal,
  selected,
  scanning,
  labeled = false,
  size = "compact",
  onSelect,
  reduce,
}: {
  signal: AuditSignal;
  selected: boolean;
  scanning: boolean;
  labeled?: boolean;
  size?: "compact" | "master";
  onSelect: () => void;
  reduce: boolean;
}) {
  const live = isAuditLive(signal);
  const confirm = presenceConfirm(signal);
  const seal = assetSeal(signal, scanning);
  const master = size === "master";
  return (
    <button
      type="button"
      title={`${signal.name} · ${seal.text}`}
      aria-label={`${signal.name}, ${seal.text}`}
      aria-pressed={selected}
      aria-busy={scanning || undefined}
      onClick={onSelect}
      className={cn(
        "group inline-flex items-center justify-center overflow-hidden border transition",
        master
          ? "h-10 min-w-0 flex-1 rounded-lg"
          : labeled
            ? "h-7 gap-1.5 rounded-md px-1.5"
            : "h-7 w-7 rounded-md",
        selected && "ring-1 ring-podium-yellow/40",
        scanning
          ? "border-podium-yellow/40 bg-podium-yellow/[0.06]"
          : live
            ? "border-podium-success/55 bg-podium-success/10 hover:border-podium-success/75"
            : confirm
              ? "border-podium-yellow/60 bg-podium-yellow/10 hover:border-podium-yellow/80"
              : "border-dashed border-white/15 bg-transparent hover:border-white/25",
        scanning && !reduce && "audit-scan-pulse",
        confirm && !scanning && !reduce && "audit-gap-pulse",
      )}
    >
      <img
        src={signal.logo}
        alt=""
        className={cn(
          "shrink-0 object-contain",
          master ? "h-6 w-6" : "h-4 w-4",
          live || confirm || scanning
            ? "opacity-100"
            : master
              ? "opacity-40"
              : "opacity-35 grayscale",
        )}
      />
      {labeled ? (
        <span
          className={cn(
            "max-w-[7.5rem] truncate text-[10px] font-medium",
            scanning
              ? "text-podium-yellow"
              : live
                ? "text-podium-success"
                : confirm
                  ? "text-podium-yellow"
                  : "text-podium-muted",
          )}
        >
          {signal.name}
        </span>
      ) : null}
    </button>
  );
}

function PresenceIconRow({
  items,
  selectedId,
  scanningIds,
  pickSignal,
  reduce,
  labeled = false,
  size = "compact",
}: {
  items: AuditSignal[];
  selectedId: string | null;
  scanningIds: Set<string>;
  pickSignal: (id: string) => void;
  reduce: boolean;
  labeled?: boolean;
  size?: "compact" | "master";
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "flex items-center",
        size === "master" ? "w-full gap-1.5 sm:gap-2" : "flex-wrap gap-1",
      )}
    >
      {items.map((signal) => (
        <PresenceIconButton
          key={signal.id}
          signal={signal}
          selected={selectedId === signal.id}
          scanning={scanningIds.has(signal.id)}
          labeled={labeled}
          size={size}
          onSelect={() => pickSignal(signal.id)}
          reduce={reduce}
        />
      ))}
    </div>
  );
}

type AuditPanelProps = {
  enrichment: LeadEnrichment | null;
  compact?: boolean;
  qualifying?: boolean;
  refreshing?: boolean;
  qualifyPending?: boolean;
  qualifyError?: string | null;
  onQualify?: () => void;
  onRefresh?: () => void;
  confirmPending?: boolean;
  onConfirmSite?: (domain: string) => void;
  onRejectSite?: (domain: string) => void;
  correctPending?: boolean;
  correctError?: string | null;
  onCorrectPresence?: (corrections: PresenceCorrection) => void;
  mapsSearchUrl?: string | null;
  className?: string;
};

type AuditBoardValue = {
  enrichment: LeadEnrichment | null;
  reduce: boolean;
  selected: AuditSignal | null;
  selectedId: string | null;
  scanningIds: Set<string>;
  pickSignal: (id: string) => void;
  presence: AuditSignal[];
  signals: AuditSignal[];
  groupsOpen: boolean;
  setGroupsOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  toolsMissingOpen: boolean;
  setToolsMissingOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  showQualifyCta: boolean;
  showRefresh: boolean;
  showBoard: boolean;
  showTools: boolean;
  previewPresence: boolean;
  awaitingAudit: boolean;
  firstRunStreaming: boolean;
  complete: boolean;
  refreshing: boolean;
  qualifyPending: boolean;
  qualifyError: string | null;
  onQualify?: () => void;
  onRefresh?: () => void;
  confirmPending: boolean;
  correctPending: boolean;
  correctError: string | null;
  chip: ReturnType<typeof qualifyChipKind>;
  siteDown: boolean;
  canConfirmSite: boolean;
  canCorrect: boolean;
  onConfirmSite?: (domain: string) => void;
  onRejectSite?: (domain: string) => void;
  onCorrectPresence?: (corrections: PresenceCorrection) => void;
  detailRef: Ref<HTMLDivElement>;
};

const AuditBoardContext = createContext<AuditBoardValue | null>(null);

function useAuditBoard() {
  const ctx = useContext(AuditBoardContext);
  if (!ctx) throw new Error("Lead ficha audit is missing its provider");
  return ctx;
}

function hasLiveToolSignal(signals: AuditSignal[]): boolean {
  return signals.some((signal) => signal.group === "ferramentas" && isAuditLive(signal));
}

export function LeadFichaAuditProvider({
  children,
  enrichment,
  qualifying = false,
  refreshing = false,
  qualifyPending = false,
  qualifyError = null,
  onQualify,
  onRefresh,
  confirmPending = false,
  onConfirmSite,
  onRejectSite,
  correctPending = false,
  correctError = null,
  onCorrectPresence,
  mapsSearchUrl,
}: Omit<AuditPanelProps, "className" | "compact"> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  const detailRef = useRef<HTMLDivElement>(null);
  const firstRunStreaming = (qualifying || qualifyPending) && !refreshing;
  const complete =
    enrichment != null && enrichmentStage(enrichment) === "complete";
  const signals = useMemo(
    () =>
      enrichment
        ? buildAuditSignals(enrichment, { mapsSearchUrl })
        : emptyAuditSignals(),
    [enrichment, mapsSearchUrl],
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
  const hasLiveTool = useMemo(() => hasLiveToolSignal(signals), [signals]);
  const autoOpenedForKey = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState(() =>
    defaultAuditSelection(signals),
  );
  const [groupsOpen, setGroupsOpen] = useState(() => hasLiveTool);
  const [toolsMissingOpen, setToolsMissingOpen] = useState(false);

  useEffect(() => {
    setSelectedId(defaultAuditSelection(signals));
    setToolsMissingOpen(false);
    setGroupsOpen(hasLiveTool);
    autoOpenedForKey.current = hasLiveTool ? auditKey : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when auditKey changes
  }, [auditKey]);

  useEffect(() => {
    if (!hasLiveTool || autoOpenedForKey.current === auditKey) return;
    setGroupsOpen(true);
    autoOpenedForKey.current = auditKey;
  }, [hasLiveTool, auditKey]);

  function pickSignal(id: string) {
    setSelectedId(id);
  }

  const selected =
    signals.find((s) => s.id === selectedId) ?? signals[0] ?? null;
  const showQualifyCta =
    Boolean(onQualify) && !onRefresh && !firstRunStreaming && !complete;
  const showRefresh = Boolean(onRefresh);
  const awaitingAudit =
    !enrichment && !firstRunStreaming && !showQualifyCta && !refreshing;
  const previewPresence = showQualifyCta;
  const auditActive = Boolean(enrichment || firstRunStreaming || refreshing);
  const showBoard = previewPresence || auditActive;
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
  const presence = GRID_PRESENCE_IDS.map(
    (id) => signals.find((s) => s.id === id),
  ).filter((s): s is AuditSignal => Boolean(s));

  const value: AuditBoardValue = {
    enrichment,
    reduce: Boolean(reduce),
    selected,
    selectedId,
    scanningIds,
    pickSignal,
    presence,
    signals,
    groupsOpen,
    setGroupsOpen,
    toolsMissingOpen,
    setToolsMissingOpen,
    showQualifyCta,
    showRefresh,
    showBoard,
    showTools,
    previewPresence,
    awaitingAudit,
    firstRunStreaming,
    complete,
    refreshing,
    qualifyPending,
    qualifyError,
    onQualify,
    onRefresh,
    confirmPending,
    correctPending,
    correctError,
    chip,
    siteDown,
    canConfirmSite,
    canCorrect,
    onConfirmSite,
    onRejectSite,
    onCorrectPresence,
    detailRef,
  };

  return (
    <AuditBoardContext.Provider value={value}>
      {children}
    </AuditBoardContext.Provider>
  );
}

export function LeadFichaAuditBoard({ className }: { className?: string }) {
  const board = useAuditBoard();
  const {
    presence,
    signals,
    selectedId,
    scanningIds,
    pickSignal,
    reduce,
    groupsOpen,
    setGroupsOpen,
    showQualifyCta,
    showRefresh,
    showBoard,
    showTools,
    previewPresence,
    awaitingAudit,
    firstRunStreaming,
    complete,
    refreshing,
    qualifyPending,
    qualifyError,
    onQualify,
    onRefresh,
    chip,
    enrichment,
  } = board;

  const toolsGroup = AUDIT_GROUPS.find((group) => group.id === "ferramentas");
  const toolSignals = signals.filter((s) => s.group === "ferramentas");

  return (
    <GlassCard className={cn("p-3 hover:translate-y-0", className)}>
      <QualifyHeader
        showRefresh={showRefresh}
        refreshing={refreshing || (Boolean(onRefresh) && qualifyPending)}
        onRefresh={onRefresh}
        chip={chip}
        action={
          showQualifyCta && onQualify ? (
            <Button
              variant="primary"
              size="sm"
              disabled={qualifyPending}
              onClick={onQualify}
              title={COPY.qualificarFichaLeadHint}
            >
              {qualifyPending
                ? "Qualificando…"
                : `${COPY.qualificar} · ${creditsPhrase(ENRICH_CREDIT_COST)}`}
            </Button>
          ) : null
        }
      />
      {showQualifyCta ? (
        <p className="mt-2 text-xs text-podium-muted">
          {COPY.qualificarFichaLead}
        </p>
      ) : null}
      {qualifyError ? (
        <p className="mt-2 text-sm text-amber-400">{qualifyError}</p>
      ) : null}
      {refreshing ? (
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-podium-yellow">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-podium-yellow" />
          {COPY.atualizandoQualificacao} Mantendo o resultado atual até terminar.
        </p>
      ) : null}
      {awaitingAudit ? (
        <p className="mt-2 text-xs leading-relaxed text-podium-gray">
          Site, redes e Google desta empresa ainda não foram buscados.
        </p>
      ) : null}
      {(firstRunStreaming || (enrichment && !complete && !refreshing)) && (
        <CompactTrail
          enrichment={enrichment}
          qualifying={firstRunStreaming || !complete}
        />
      )}

      {showBoard ? (
        <div className="mt-3">
          <PresenceIconRow
            items={presence}
            selectedId={selectedId}
            scanningIds={scanningIds}
            pickSignal={pickSignal}
            reduce={reduce}
            size="master"
          />
          <p className="mt-2 text-[11px] text-podium-muted">
            {COPY.fichaAuditSelectHint}
          </p>
          {showTools ? (
            <button
              type="button"
              aria-expanded={groupsOpen}
              onClick={() => setGroupsOpen((open) => !open)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-podium-muted hover:text-podium-yellow"
            >
              {groupsOpen ? COPY.fichaAuditGroupsClose : COPY.fichaAuditGroupsOpen}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition", groupsOpen && "rotate-180")}
              />
            </button>
          ) : null}
        </div>
      ) : null}

      {showBoard && groupsOpen && showTools && toolsGroup ? (
        <section className="mt-3">
          {!previewPresence ? (
            <p className="text-[11px] text-podium-muted">{toolsGroup.hint}</p>
          ) : null}
          <div className="mt-1.5">
            <PresenceIconRow
              items={toolSignals}
              selectedId={selectedId}
              scanningIds={scanningIds}
              pickSignal={pickSignal}
              reduce={reduce}
              labeled
            />
          </div>
        </section>
      ) : null}
    </GlassCard>
  );
}

export function LeadFichaAuditDetail({ className }: { className?: string }) {
  const board = useAuditBoard();
  const {
    selected,
    scanningIds,
    siteDown,
    canConfirmSite,
    confirmPending,
    enrichment,
    onConfirmSite,
    onRejectSite,
    canCorrect,
    correctPending,
    correctError,
    onCorrectPresence,
    detailRef,
  } = board;

  if (!selected) {
    return (
      <GlassCard
        className={cn("p-2.5 hover:translate-y-0", className)}
      >
        <p className="text-sm leading-relaxed text-podium-gray">
          {COPY.fichaAuditSelectHint}
        </p>
      </GlassCard>
    );
  }

  const mapsSelected = selected.id === "maps";
  const pinConfirmable = mapsPinConfirmable(enrichment);

  return (
    <GlassCard className={cn("p-2.5 hover:translate-y-0", className)}>
      <div key={selected.id}>
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
            canConfirmMapsPin={mapsSelected && pinConfirmable && canCorrect}
            canRejectMaps={
              mapsSelected &&
              canCorrect &&
              presenceConfirm(selected) &&
              !pinConfirmable
            }
            correctPending={correctPending}
            correctError={correctError}
            editSeed={
              isEditablePresence(selected.id)
                ? presenceSeed(selected.id, enrichment)
                : ""
            }
            onCorrect={onCorrectPresence}
          />
      </div>
    </GlassCard>
  );
}

export function DigitalAuditPanel(props: AuditPanelProps) {
  const { className, compact: _compact, ...board } = props;
  return (
    <LeadFichaAuditProvider {...board}>
      <div className={cn("flex flex-col gap-3", className)}>
        <LeadFichaAuditBoard />
        <LeadFichaAuditDetail />
      </div>
    </LeadFichaAuditProvider>
  );
}
