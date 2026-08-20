"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnatomyCard } from "@/components/AnatomyCard";
import { ApproachDoors } from "@/components/ApproachDoors";
import { CallButton } from "@/components/CallButton";
import { ContactSealBadge } from "@/components/ContactSeal";
import { DigitalAuditPanel } from "@/components/DigitalAuditPanel";
import { FichaChip } from "@/components/FichaChip";
import { GlassCard } from "@/components/GlassCard";
import { LeadCompanyCard } from "@/components/LeadCompanyCard";
import { LeadStatusStrip } from "@/components/LeadStatusStrip";
import { leadBack, leadHref, parseGridFrom } from "@/lib/back";
import {
  blockQualifyIfFree,
  isBillingGateError,
  throwIfBillingGate,
} from "@/lib/billing/paywall";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import { usePaywall } from "@/components/PaywallDialog";
import { formatPhone, toE164, yearsSince } from "@/lib/format";
import type {
  ContactInfo,
  EnrichmentJobStatus,
  LeadEnrichment,
  LeadStatus,
  PilotStats,
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
import { cn } from "@/lib/utils";

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
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <GlassCard className="p-6 hover:translate-y-0">
          <p className="text-xs uppercase tracking-wide text-podium-gray">Fale com</p>
          <p className="mt-1 text-lg font-extrabold text-podium-yellow">
            {preview.decisorNome ?? "Sem sócio no quadro"}
          </p>
          {phone ? (
            <div className="mt-5 rounded-2xl border border-podium-yellow/25 bg-podium-yellow/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-podium-muted">
                Ligar agora
              </p>
              <p className="mt-1 text-lg font-extrabold">{phone}</p>
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
        <div className="flex min-h-0 flex-col gap-4">
          <LeadCompanyCard
            title={displayCompanyName(preview.nomeFantasia, preview.razaoSocial)}
            razaoSocial={preview.razaoSocial}
            showRazao={Boolean(preview.nomeFantasia)}
            cityLine={cityLine}
            cnaeDescricao={preview.cnaeDescricao}
            cnpj={preview.cnpj}
          />
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        </div>
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
  const [qualifyQueued, setQualifyQueued] = useState(false);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    setQualifyQueued(false);
    setQualifyError(null);
    setCalling(false);
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

  useEffect(() => {
    const job = liveJobStatus;
    const stage = liveEnrichment ? enrichmentStage(liveEnrichment) : null;
    const finished =
      stage === "complete" || job === "failed" || job === "skipped";
    if (!finished || !qualifyQueued) return;
    setQualifyQueued(false);
    void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
  }, [liveJobStatus, liveEnrichment, qualifyQueued, params.cnpj, qc, searchId]);

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
  const fillCard = "hover:translate-y-0";

  function markLigando() {
    setCalling(true);
    if (d?.status === "novo") saveMutation.mutate({ status: "ligando" });
  }

  const cityLine = [d.municipioNome, est.uf].filter(Boolean).join(" · ");

  return (
    <AppShell fill title="Ficha" back={back}>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="order-1 flex min-h-0 flex-col gap-4">
          <GlassCard className={cn("p-6", fillCard)}>
            <p className="text-xs uppercase tracking-wide text-podium-gray">Fale com</p>
            <p className="mt-1 text-lg font-extrabold text-podium-yellow">
              {d.decisor?.nome ?? "Sem sócio no quadro"}
            </p>
            <p className="mt-1 text-xs text-podium-gray">
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
                <p className="mt-1 text-lg font-extrabold">
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

            {others.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                  Outros números
                </p>
                {others.map((c, i) => (
                  <div
                    key={contactKey(c, i)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={`tel:+55${c.ddd}${c.telefone}`}
                        className="text-sm font-bold"
                      >
                        {formatPhone(c.ddd, c.telefone)}
                      </a>
                      <ContactSealBadge
                        seal={c.seal}
                        label={c.label}
                        compact
                        className="mt-0.5"
                      />
                      {c.sideNote ? (
                        <p className="mt-0.5 text-xs text-podium-muted">{c.sideNote}</p>
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {wa ? (
                <FichaChip as="a" href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </FichaChip>
              ) : (
                <FichaChip type="button" disabled>
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </FichaChip>
              )}
              {needsMapsHint ? (
                <FichaChip as="a" href={mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin className="h-3.5 w-3.5" />
                  Conferir no Maps
                </FichaChip>
              ) : null}
              <ApproachDoors
                decisorNome={d.decisor?.nome}
                socios={d.socios ?? []}
                enrichment={liveEnrichment}
              />
            </div>
          </GlassCard>

          <AnatomyCard
            market={d.market}
            uf={est.uf}
            decisorNome={d.decisor?.nome}
            volta={
              statsQuery.data
                ? `volta ${statsQuery.data.hoje}/${statsQuery.data.meta}`
                : null
            }
          />

          <LeadStatusStrip
            key={params.cnpj}
            status={d.status}
            notas={d.notas}
            recordPending={recordCall.isPending}
            onStatus={(status) => saveMutation.mutate({ status })}
            onRecordCall={() => recordCall.mutate()}
            onNotasBlur={(notas) => saveMutation.mutate({ notas })}
          />
        </div>

        <div className="order-2 flex min-h-0 flex-col gap-4">
          <LeadCompanyCard
            title={companyTitle}
            razaoSocial={company.razao_social}
            showRazao={Boolean(est.nome_fantasia)}
            cityLine={cityLine}
            cnaeDescricao={d.cnaeDescricao}
            cnpj={est.cnpj}
            gridPosition={d.gridPosition}
            gridScore={d.gridScore}
            company={company}
            establishment={est}
            municipioNome={d.municipioNome}
            addressSharedCount={d.addressSharedCount}
            emailSeal={d.emailSeal}
          />

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
        </div>
      </div>
    </AppShell>
  );
}
