"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnatomyCard } from "@/components/AnatomyCard";
import { ApproachDoors } from "@/components/ApproachDoors";
import { CallButton } from "@/components/CallButton";
import { ContactSealBadge } from "@/components/ContactSeal";
import { DigitalAuditPanel } from "@/components/DigitalAuditPanel";
import { EmptyValue } from "@/components/EmptyValue";
import { GlassCard } from "@/components/GlassCard";
import { MarketCockpit } from "@/components/MarketCockpit";
import { PositionBadge } from "@/components/PositionBadge";
import { SectionTitle } from "@/components/SectionTitle";
import { leadBack, leadHref, parseGridFrom } from "@/lib/back";
import {
  blockQualifyIfFree,
  isBillingGateError,
  throwIfBillingGate,
} from "@/lib/billing/paywall";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import { usePaywall } from "@/components/PaywallDialog";
import {
  formatCapital,
  formatCnpj,
  formatDateBr,
  formatPhone,
  formatPorte,
  toE164,
  yearsSince,
} from "@/lib/format";
import type {
  ContactInfo,
  EnrichmentJobStatus,
  LeadDossier,
  LeadEnrichment,
  LeadStatus,
  PilotStats,
  Profile,
} from "@/lib/types";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { enrichmentStage } from "@/lib/enrichment/fresh";
import {
  fetchLeadDossier,
  leadPreviewKey,
  leadQueryKey,
  type LeadPreview,
} from "@/lib/lead-query";
import {
  anatomyBeatsFromScript,
  buildOpeningScript,
  copyAnatomyScript,
  scriptFromAnatomyBeats,
} from "@/lib/golden-minute-script";
import { cn } from "@/lib/utils";

const STATUSES: Array<{ id: LeadStatus; label: string }> = [
  { id: "novo", label: "Novo" },
  { id: "ligando", label: "Ligando" },
  { id: "reuniao", label: "Reunião" },
  { id: "descartado", label: "Descartado" },
];

function pickPrimary(contacts: ContactInfo[]): ContactInfo | null {
  return (
    contacts.find((c) => c.seal === "CONFIRMADO") ??
    contacts.find((c) => c.seal === "ATUALIZADO") ??
    contacts[0] ??
    null
  );
}

function contactKey(c: ContactInfo, i: number) {
  return `${c.ddd}-${c.telefone}-${i}`;
}

function LeadPreviewShell({
  preview,
  back,
}: {
  preview: LeadPreview;
  back: ReturnType<typeof leadBack>;
}) {
  const ddd = preview.telefone?.slice(0, 2) ?? null;
  const tel = preview.telefone?.slice(2) ?? null;
  const phone = formatPhone(ddd, tel);
  const cityLine = [preview.municipio, preview.uf].filter(Boolean).join(" · ");
  return (
    <AppShell fill title="Ficha" back={back}>
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <p className="text-xs uppercase tracking-wide text-podium-gray">Fale com</p>
          <p className="mt-1 text-2xl font-extrabold text-podium-yellow">
            {preview.decisorNome ?? "Sem sócio no quadro"}
          </p>
          {phone ? (
            <div className="mt-5 rounded-2xl border border-podium-yellow/25 bg-podium-yellow/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-podium-muted">
                Ligar agora
              </p>
              <p className="mt-1 text-xl font-extrabold">{phone}</p>
              {preview.seal ? (
                <ContactSealBadge
                  seal={preview.seal}
                  label=""
                  compact
                  className="mt-1"
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-podium-muted">Carregando contato…</p>
          )}
        </GlassCard>
        <GlassCard className="p-6 md:p-8">
          <h1 className="text-2xl font-extrabold">
            {displayCompanyName(preview.nomeFantasia, preview.razaoSocial)}
          </h1>
          {preview.nomeFantasia ? (
            <p className="text-sm text-podium-muted">{preview.razaoSocial}</p>
          ) : null}
          <p className="mt-2 text-sm text-podium-gray">{cityLine || <EmptyValue />}</p>
          <p className="mt-1 line-clamp-2 text-sm text-podium-gray">
            {preview.cnaeDescricao}
          </p>
          <p className="mt-1 text-sm tabular-nums text-podium-muted">
            {formatCnpj(preview.cnpj)}
          </p>
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-white/5" />
        </GlassCard>
      </div>
    </AppShell>
  );
}

export default function LeadPage() {
  const params = useParams<{ cnpj: string }>();
  const searchParams = useSearchParams();
  const searchId = searchParams.get("searchId") ?? undefined;
  const from = parseGridFrom(searchParams.get("from"));
  const back = leadBack(searchId, searchParams.get("from"));
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const billingQuery = useBillingMe();
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [qualifyQueued, setQualifyQueued] = useState(false);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [scriptTouched, setScriptTouched] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  useEffect(() => {
    setQualifyQueued(false);
    setQualifyError(null);
    setCalling(false);
    setScriptTouched(false);
    setScript("");
    setShowCadastro(false);
    setShowOthers(false);
  }, [params.cnpj]);

  const dossierQuery = useQuery({
    queryKey: leadQueryKey(params.cnpj, searchId),
    queryFn: () => fetchLeadDossier(params.cnpj, searchId),
    staleTime: 30_000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      const tabulated = status === "reuniao" || status === "descartado";
      const live = !tabulated && (calling || status === "ligando");
      if (live) return 2500;
      return false;
    },
  });
  const previewQuery = useQuery({
    queryKey: leadPreviewKey(params.cnpj),
    queryFn: async () =>
      qc.getQueryData<LeadPreview>(leadPreviewKey(params.cnpj)) ?? null,
    staleTime: Infinity,
    enabled: false,
  });

  const streamQuery = useQuery({
    queryKey: ["lead-stream", params.cnpj],
    queryFn: async () => {
      const res = await fetch(`/api/enrich?cnpj=${params.cnpj}`);
      if (!res.ok) {
        return {
          enrichment: null as LeadEnrichment | null,
          jobStatus: null as EnrichmentJobStatus | null,
        };
      }
      return (await res.json()) as {
        enrichment: LeadEnrichment | null;
        jobStatus: EnrichmentJobStatus | null;
      };
    },
    enabled:
      qualifyQueued ||
      dossierQuery.data?.enrichmentJobStatus === "pending" ||
      dossierQuery.data?.enrichmentJobStatus === "running" ||
      (dossierQuery.data?.enrichment != null &&
        enrichmentStage(dossierQuery.data.enrichment) !== "complete"),
    refetchInterval: 1000,
  });

  useEffect(() => {
    const status = dossierQuery.data?.status;
    if (status === "reuniao" || status === "descartado") {
      setCalling(false);
      void qc.invalidateQueries({ queryKey: ["pilot-stats"] });
    }
  }, [dossierQuery.data?.status, qc]);

  const connectionsQuery = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) return { connections: [] as IntegrationConnectionPublic[] };
      return (await res.json()) as { connections: IntegrationConnectionPublic[] };
    },
  });

  const statsQuery = useQuery({
    queryKey: ["pilot-stats"],
    queryFn: async () => {
      const res = await fetch("/api/profile/stats");
      if (!res.ok) throw new Error("stats");
      return (await res.json()) as PilotStats;
    },
    refetchInterval: (() => {
      const status = dossierQuery.data?.status;
      const tabulated = status === "reuniao" || status === "descartado";
      const live = !tabulated && (calling || status === "ligando");
      return live ? 2500 : false;
    })(),
  });

  const d = dossierQuery.data;
  const liveEnrichment = streamQuery.data?.enrichment ?? d?.enrichment ?? null;
  const liveJobStatus =
    streamQuery.data?.jobStatus ?? d?.enrichmentJobStatus ?? null;

  const defaultScript = useMemo(() => {
    if (!d) return "";
    return buildOpeningScript(d.profile, {
      decisorNome: d.decisor?.nome,
      market: d.market,
    });
  }, [d]);

  useEffect(() => {
    if (!defaultScript || scriptTouched) return;
    setScript(defaultScript);
  }, [defaultScript, scriptTouched]);

  useEffect(() => {
    const job = liveJobStatus;
    const stage = liveEnrichment ? enrichmentStage(liveEnrichment) : null;
    const finished =
      stage === "complete" || job === "failed" || job === "skipped";
    if (!finished || !qualifyQueued) return;
    setQualifyQueued(false);
    void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
  }, [liveJobStatus, liveEnrichment, qualifyQueued, params.cnpj, qc]);

  const saveMutation = useMutation({
    mutationFn: async (patch: { status?: LeadStatus; notas?: string }) => {
      await fetch(`/api/lead/${params.cnpj}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, savedLeadId: d?.savedLeadId, searchId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      qc.invalidateQueries({ queryKey: ["pilot-stats"] });
    },
  });

  const recordCall = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/profile/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: params.cnpj,
          savedLeadId: d?.savedLeadId ?? null,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível registrar");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      qc.invalidateQueries({ queryKey: ["pilot-stats"] });
    },
  });

  const qualifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(searchId ? { searchId } : {}),
          cnpjs: [params.cnpj],
        }),
      });
      const json = (await res.json()) as { error?: string };
      throwIfBillingGate(res.status, json, openPaywall, "qualify");
      if (!res.ok) throw new Error(json.error ?? "Não foi possível qualificar");
      return json;
    },
    onMutate: () => {
      setQualifyQueued(true);
      setQualifyError(null);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      void qc.invalidateQueries({ queryKey: ["lead-stream", params.cnpj] });
      void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
      if (searchId) {
        void qc.invalidateQueries({ queryKey: ["enrich-jobs", searchId] });
        void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      }
    },
    onError: (err: Error) => {
      setQualifyQueued(false);
      if (isBillingGateError(err)) return;
      setQualifyError(err.message);
    },
  });

  const confirmSiteMutation = useMutation({
    mutationFn: async (input: { action: "confirm" | "reject"; domain: string }) => {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(searchId ? { searchId } : {}),
          cnpjs: [params.cnpj],
          action: input.action,
          domain: input.domain,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar o site");
      return json;
    },
    onMutate: () => {
      setQualifyQueued(true);
      setQualifyError(null);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      void qc.invalidateQueries({ queryKey: ["lead-stream", params.cnpj] });
    },
    onError: (err: Error) => {
      setQualifyQueued(false);
      setQualifyError(err.message);
    },
  });

  if (!d) {
    const preview =
      previewQuery.data ??
      qc.getQueryData<LeadPreview>(leadPreviewKey(params.cnpj)) ??
      null;
    if (dossierQuery.isLoading && preview) {
      return <LeadPreviewShell preview={preview} back={back} />;
    }
    if (dossierQuery.isLoading) {
      return (
        <AppShell fill title="Ficha" back={back}>
          <div className="min-h-0 flex-1 animate-pulse rounded-2xl bg-white/5" />
        </AppShell>
      );
    }
    return (
      <AppShell title="Ficha" back={back}>
        <p className="text-podium-muted">Lead não encontrado</p>
      </AppShell>
    );
  }

  const est = d.establishment;
  const company = d.company;
  const years = yearsSince(d.decisor?.dataEntrada ?? null);
  const primary = pickPrimary(d.contacts);
  const others = d.contacts.filter((c) => c !== primary);
  const callConnection = pickCallConnection(
    connectionsQuery.data?.connections ?? [],
  );
  const companyTitle = displayCompanyName(est.nome_fantasia, company.razao_social);
  const mapsQuery = [companyTitle, d.municipioNome, est.uf]
    .filter(Boolean)
    .join(" ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const primaryE164 = primary
    ? toE164(primary.ddd, primary.telefone)
    : null;
  const wa = primaryE164 ? `https://wa.me/${primaryE164}` : null;
  const needsMapsHint =
    primary?.seal === "COMPARTILHADO" || primary?.seal === "NAO_CONFIRMADO";
  const opened = formatDateBr(est.data_inicio);
  const fillCard = "hover:translate-y-0";
  const anatomyBeats = anatomyBeatsFromScript(script);

  function setAnatomyBeat(index: number, value: string) {
    const next = [...anatomyBeats];
    next[index] = value.replace(/\r?\n/g, " ");
    setScriptTouched(true);
    setScript(scriptFromAnatomyBeats(next));
  }

  function markLigando() {
    setCalling(true);
    if (d?.status === "novo") saveMutation.mutate({ status: "ligando" });
  }

  const cityLine = [d.municipioNome, est.uf].filter(Boolean).join(" · ");

  return (
    <AppShell fill title="Ficha" back={back}>
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        <div className="order-1 flex min-h-0 flex-col gap-4">
          <GlassCard className={cn("p-6", fillCard)}>
            <p className="text-xs uppercase tracking-wide text-podium-gray">Fale com</p>
            <p className="mt-1 text-2xl font-extrabold text-podium-yellow">
              {d.decisor?.nome ?? "Sem sócio no quadro"}
            </p>
            <p className="mt-1 text-sm text-podium-gray">
              {d.decisor
                ? `${d.decisor.qualificacao}${years != null ? ` · sócio há ${years} anos` : ""}`
                : "Nenhum decisor listado na Receita."}
            </p>

            {primary ? (
              <div className="mt-5 rounded-2xl border border-podium-yellow/25 bg-podium-yellow/5 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-podium-muted">
                  {callConnection &&
                  d.status !== "reuniao" &&
                  d.status !== "descartado" &&
                  (calling || d.status === "ligando") ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-podium-yellow opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-podium-yellow" />
                      </span>
                      em chamada
                    </>
                  ) : (
                    "Ligar agora"
                  )}
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {formatPhone(primary.ddd, primary.telefone)}
                </p>
                <ContactSealBadge
                  seal={primary.seal}
                  label={primary.label}
                  className="mt-1"
                />
                {primary.sideNote ? (
                  <p className="mt-1 text-xs text-podium-muted">{primary.sideNote}</p>
                ) : null}
                {needsMapsHint ? (
                  <p className="mt-2 text-xs text-podium-muted">
                    Confira no Maps antes de discar.
                  </p>
                ) : null}
                <div className="mt-4">
                  <CallButton
                    telHref={`tel:+55${primary.ddd}${primary.telefone}`}
                    connection={callConnection}
                    cnpj={params.cnpj}
                    searchId={searchId}
                    to={primaryE164 ? `+${primaryE164}` : undefined}
                    variant="cockpit"
                    onCalled={markLigando}
                  />
                </div>
                {(() => {
                  const next = statsQuery.data?.proximaFicha;
                  if (
                    !next ||
                    next.cnpj === params.cnpj ||
                    (d.status !== "reuniao" && d.status !== "descartado")
                  ) {
                    return null;
                  }
                  return (
                    <Link
                      href={leadHref(next.cnpj, next.searchId, from)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-podium-yellow/40 px-4 py-2.5 text-sm font-extrabold text-podium-yellow hover:bg-podium-yellow/10"
                    >
                      P{next.gridPosition} · {next.nome}
                    </Link>
                  );
                })()}
              </div>
            ) : (
              <p className="mt-4 text-sm text-podium-muted">Sem telefone neste lead.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 px-3 py-2 text-xs font-bold text-podium-muted opacity-50"
                >
                  WhatsApp
                </button>
              )}
              {needsMapsHint ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Conferir no Maps
                </a>
              ) : null}
            </div>
            <ApproachDoors
              decisorNome={d.decisor?.nome}
              socios={d.socios ?? []}
              enrichment={liveEnrichment}
            />
          </GlassCard>

          <AnatomyCard
            beats={anatomyBeats}
            editing={editingScript}
            onToggleEdit={() => setEditingScript((v) => !v)}
            onChangeBeat={setAnatomyBeat}
            onCopy={async () => {
              await navigator.clipboard.writeText(copyAnatomyScript(script));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            copied={copied}
            duracao={d.profile.duracao_reuniao}
            volta={
              statsQuery.data
                ? `volta ${statsQuery.data.hoje}/${statsQuery.data.meta}`
                : null
            }
          />

          <GlassCard className={cn("p-6 md:p-8", fillCard)}>
            <div className="flex items-start gap-3">
              {d.gridPosition != null && (
                <PositionBadge position={d.gridPosition} score={d.gridScore} />
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold">{companyTitle}</h1>
                {est.nome_fantasia ? (
                  <p className="text-sm text-podium-muted">{company.razao_social}</p>
                ) : null}
                <p className="mt-2 text-sm text-podium-gray">
                  {cityLine || <EmptyValue />}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-podium-gray">
                  {d.cnaeDescricao}
                </p>
                <p className="mt-1 text-sm tabular-nums text-podium-muted">
                  {formatCnpj(est.cnpj)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCadastro((v) => !v)}
              aria-expanded={showCadastro}
              className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left hover:border-white/20"
            >
              <span className="text-sm font-bold">Cadastro da Receita</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-podium-muted transition",
                  showCadastro && "rotate-180",
                )}
              />
            </button>
            {showCadastro ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-podium-muted">Porte</dt>
                  <dd>{formatPorte(company.porte)}</dd>
                </div>
                <div>
                  <dt className="text-podium-muted">Abertura</dt>
                  <dd>{opened ?? <EmptyValue />}</dd>
                </div>
                <div>
                  <dt className="text-podium-muted">Capital social</dt>
                  <dd>{formatCapital(company.capital_social)}</dd>
                </div>
                <div>
                  <dt className="text-podium-muted">CNPJ</dt>
                  <dd className="font-medium">{formatCnpj(est.cnpj)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-podium-muted">Endereço</dt>
                  <dd>
                    {[est.logradouro, est.numero, est.bairro, d.municipioNome, est.uf, est.cep]
                      .filter(Boolean)
                      .join(", ") || <EmptyValue />}
                    {d.addressSharedCount >= 5 && (
                      <span className="mt-1 block text-xs text-amber-400">
                        endereço aparece em {d.addressSharedCount} empresas
                      </span>
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-podium-muted">E-mail</dt>
                  <dd>
                    {d.emailSeal.email ? (
                      <>
                        <a href={`mailto:${d.emailSeal.email}`} className="text-podium-yellow">
                          {d.emailSeal.email}
                        </a>
                        {(d.emailSeal.shared ||
                          d.emailSeal.free ||
                          d.emailSeal.accountantHint) && (
                          <span className="mt-1 block text-xs text-amber-400">
                            {d.emailSeal.shared && "e-mail compartilhado · "}
                            {d.emailSeal.free && "provedor gratuito · "}
                            {d.emailSeal.accountantHint && "domínio com assinatura contábil"}
                          </span>
                        )}
                      </>
                    ) : (
                      <EmptyValue />
                    )}
                  </dd>
                </div>
              </dl>
            ) : null}
          </GlassCard>

          <MarketCockpit market={d.market} uf={est.uf} />

          <GlassCard className={cn("space-y-4 p-6", fillCard)}>
            <div>
              <p className="text-sm text-podium-gray">Status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => saveMutation.mutate({ status: s.id })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-bold",
                      d.status === s.id
                        ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                        : "border-white/10 text-podium-gray hover:border-white/20",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={recordCall.isPending}
              onClick={() => recordCall.mutate()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow disabled:opacity-40"
            >
              <Phone className="h-4 w-4" />
              {recordCall.isPending ? "Registrando…" : "Registrei a ligação"}
            </button>
            <label className="block text-sm text-podium-gray">
              Notas
              <textarea
                defaultValue={d.notas ?? ""}
                onBlur={(e) => saveMutation.mutate({ notas: e.target.value })}
                rows={3}
                placeholder="O que rolou na ligação"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm outline-none focus:border-podium-yellow/40"
              />
            </label>
          </GlassCard>
        </div>

        <div className="order-2 flex min-h-0 flex-col gap-4">
          <DigitalAuditPanel
            enrichment={liveEnrichment}
            qualifying={
              qualifyQueued ||
              liveJobStatus === "pending" ||
              liveJobStatus === "running" ||
              (liveEnrichment != null &&
                enrichmentStage(liveEnrichment) !== "complete")
            }
            qualifyPending={qualifyMutation.isPending}
            qualifyError={qualifyError}
            onQualify={() => {
              if (
                blockQualifyIfFree(
                  billingQuery.data?.balance.enrichAllowed,
                  openPaywall,
                )
              ) {
                return;
              }
              qualifyMutation.mutate();
            }}
            mapsUrl={mapsUrl}
            goldenMinute={d.goldenMinute}
            confirmPending={confirmSiteMutation.isPending}
            onConfirmSite={(domain) =>
              confirmSiteMutation.mutate({ action: "confirm", domain })
            }
            onRejectSite={(domain) =>
              confirmSiteMutation.mutate({ action: "reject", domain })
            }
          />

          {others.length > 0 ? (
            <GlassCard className={cn("p-6", fillCard)}>
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <SectionTitle className="text-lg">Outros números</SectionTitle>
                <span className="text-xs font-bold text-podium-yellow">
                  {showOthers ? "Recolher" : `${others.length} no dossiê`}
                </span>
              </button>
              {showOthers ? (
                <div className="mt-4 space-y-3">
                  {others.map((c, i) => (
                    <div
                      key={contactKey(c, i)}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 last:border-0"
                    >
                      <div>
                        <a
                          href={`tel:+55${c.ddd}${c.telefone}`}
                          className="font-bold"
                        >
                          {formatPhone(c.ddd, c.telefone)}
                        </a>
                        <ContactSealBadge
                          seal={c.seal}
                          label={c.label}
                          compact
                          className="mt-1"
                        />
                        {c.sideNote ? (
                          <p className="mt-1 text-xs text-podium-muted">{c.sideNote}</p>
                        ) : null}
                      </div>
                      <CallButton
                        telHref={`tel:+55${c.ddd}${c.telefone}`}
                        connection={callConnection}
                        cnpj={params.cnpj}
                        searchId={searchId}
                        to={
                          toE164(c.ddd, c.telefone)
                            ? `+${toE164(c.ddd, c.telefone)}`
                            : undefined
                        }
                        variant="ficha"
                        onCalled={markLigando}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </GlassCard>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
