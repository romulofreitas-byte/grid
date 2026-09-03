"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnatomyCard } from "@/components/AnatomyCard";
import { SociosPanel } from "@/components/ApproachDoors";
import { CallButton } from "@/components/CallButton";
import { ContactSealBadge } from "@/components/ContactSeal";
import { DigitalAuditPanel } from "@/components/DigitalAuditPanel";
import { GlassCard } from "@/components/GlassCard";
import { LeadCompanyCard } from "@/components/LeadCompanyCard";
import { LeadStatusStrip } from "@/components/LeadStatusStrip";
import { SaveListDialog } from "@/components/SaveListDialog";
import { Button } from "@/components/ui/Button";
import { leadBack, leadHref, parseGridFrom, crmHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
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
  LeadDossier,
  LeadEnrichment,
  LeadStatus,
  PilotStats,
} from "@/lib/types";
import type { FichaMoveKey } from "@/lib/crm/cadence";
import { fichaCrmPrompt } from "@/lib/crm/ficha-prompt";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { displayCompanyName, leadMapsHref } from "@/lib/enrichment/company-name";
import type { PresenceCorrection } from "@/lib/enrichment/correct-presence";
import { enrichmentStage } from "@/lib/enrichment/fresh";
import { ENRICH_QUEUE_STUCK_MS } from "@/lib/enrichment/jobs";
import {
  fetchLeadDossier,
  leadPreviewKey,
  leadQueryKey,
  normalizeLeadCnpj,
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
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4">
        <LeadCompanyCard
          title={displayCompanyName(preview.nomeFantasia, preview.razaoSocial)}
          razaoSocial={preview.razaoSocial}
          showRazao={Boolean(preview.nomeFantasia)}
          cityLine={cityLine}
          cnaeDescricao={preview.cnaeDescricao}
          cnpj={preview.cnpj}
        />
        <GlassCard className="border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            Contato
          </p>
          <p className="mt-1 text-sm font-medium text-podium-white">
            {preview.decisorNome ?? "Sem sócio no quadro"}
          </p>
          {phone ? (
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Telefone
              </p>
              <p className="mt-1 text-sm font-medium">{phone}</p>
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
        <div className="h-24 animate-pulse rounded-lg bg-white/5" />
      </div>
    </AppShell>
  );
}

export default function LeadPage() {
  const params = useParams<{ cnpj: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = searchParams.get("searchId") ?? undefined;
  const from = parseGridFrom(searchParams.get("from"));
  const back = leadBack(searchId, searchParams.get("from"));
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const billingQuery = useBillingMe();
  const [qualifyQueued, setQualifyQueued] = useState(false);
  const [refreshQueued, setRefreshQueued] = useState(false);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [savingPista, setSavingPista] = useState(false);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [saveListName, setSaveListName] = useState("");
  const [saveListError, setSaveListError] = useState<string | null>(null);
  const heldCompleteRef = useRef<LeadEnrichment | null>(null);
  const ensuringRef = useRef<string | null>(null);
  const sawQueuedJobRef = useRef(false);
  const watchCollectedAtRef = useRef<string | null>(null);

  useEffect(() => {
    setQualifyQueued(false);
    setRefreshQueued(false);
    setQualifyError(null);
    setCorrectError(null);
    setCalling(false);
    setSavingPista(false);
    setSaveListOpen(false);
    setSaveListError(null);
    heldCompleteRef.current = null;
    sawQueuedJobRef.current = false;
    watchCollectedAtRef.current = null;
  }, [params.cnpj]);

  const dossierQuery = useQuery({
    queryKey: leadQueryKey(params.cnpj, searchId),
    queryFn: () => fetchLeadDossier(params.cnpj, searchId),
    staleTime: 0,
    refetchOnMount: "always",
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
    queryKey: ["lead-stream", normalizeLeadCnpj(params.cnpj)],
    queryFn: async () => {
      const res = await fetch(`/api/enrich?cnpj=${normalizeLeadCnpj(params.cnpj)}`);
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
      refreshQueued ||
      dossierQuery.data?.enrichmentJobStatus === "pending" ||
      dossierQuery.data?.enrichmentJobStatus === "running" ||
      // Job finished on the grid but dossier cache may still lack enrichment.
      (dossierQuery.data?.enrichmentJobStatus === "done" &&
        dossierQuery.data?.enrichment == null) ||
      (dossierQuery.data?.enrichment != null &&
        enrichmentStage(dossierQuery.data.enrichment) !== "complete" &&
        !refreshQueued),
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
    if (liveEnrichment && enrichmentStage(liveEnrichment) === "complete") {
      heldCompleteRef.current = liveEnrichment;
    }
  }, [liveEnrichment]);

  const ensureKey = `${params.cnpj}:${searchId ?? ""}`;
  useEffect(() => {
    const wasQualified =
      Boolean(d?.wasQualified) ||
      (d?.enrichment != null && enrichmentStage(d.enrichment) === "complete") ||
      heldCompleteRef.current != null;
    if (!d?.searchSaved || d.crm || !wasQualified || !searchId) return;
    if (ensuringRef.current === ensureKey) return;
    ensuringRef.current = ensureKey;
    void fetch("/api/session/catch-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchId, cnpjs: [params.cnpj] }),
    }).then((res) => {
      if (!res.ok) {
        ensuringRef.current = null;
        return;
      }
      void qc.invalidateQueries({
        queryKey: leadQueryKey(params.cnpj, searchId),
      });
      void qc.invalidateQueries({ queryKey: ["grid", searchId] });
    });
  }, [
    d?.searchSaved,
    d?.crm,
    d?.wasQualified,
    d?.enrichment,
    ensureKey,
    params.cnpj,
    qc,
    searchId,
  ]);

  // Keep yesterday's complete audit on screen while a paid refresh runs.
  const displayEnrichment =
    refreshQueued &&
    heldCompleteRef.current &&
    (!liveEnrichment || enrichmentStage(liveEnrichment) !== "complete")
      ? heldCompleteRef.current
      : liveEnrichment;

  const hasCompleteAudit =
    (displayEnrichment != null &&
      enrichmentStage(displayEnrichment) === "complete") ||
    heldCompleteRef.current != null;

  function startJobWatch(kind: "first" | "refresh") {
    sawQueuedJobRef.current = false;
    watchCollectedAtRef.current =
      heldCompleteRef.current?.collected_at ??
      liveEnrichment?.collected_at ??
      null;
    if (kind === "refresh") {
      setRefreshQueued(true);
      setQualifyQueued(false);
    } else {
      setQualifyQueued(true);
      setRefreshQueued(false);
    }
  }

  function applyEnrichmentPatch(
    enrichment: LeadEnrichment,
    jobStatus?: EnrichmentJobStatus | null,
  ) {
    const cnpj = normalizeLeadCnpj(params.cnpj);
    qc.setQueryData(leadQueryKey(params.cnpj, searchId), (old: LeadDossier | undefined) =>
      old
        ? {
            ...old,
            enrichment,
            enrichmentJobStatus: jobStatus ?? old.enrichmentJobStatus,
          }
        : old,
    );
    qc.setQueryData(
      ["lead-stream", cnpj],
      (
        old:
          | {
              enrichment: LeadEnrichment | null;
              jobStatus: EnrichmentJobStatus | null;
            }
          | undefined,
      ) => ({
        enrichment,
        jobStatus: jobStatus ?? old?.jobStatus ?? null,
      }),
    );
  }

  useEffect(() => {
    if (!qualifyQueued && !refreshQueued) return;
    const job = liveJobStatus;
    const stage = liveEnrichment ? enrichmentStage(liveEnrichment) : null;
    if (job === "pending" || job === "running") {
      sawQueuedJobRef.current = true;
      return;
    }
    const collectedChanged =
      liveEnrichment?.collected_at != null &&
      liveEnrichment.collected_at !== watchCollectedAtRef.current;
    const failed = job === "failed" || job === "skipped";
    const completedNew =
      stage === "complete" && (sawQueuedJobRef.current || collectedChanged);
    if (!failed && !completedNew) return;
    setQualifyQueued(false);
    setRefreshQueued(false);
    sawQueuedJobRef.current = false;
    void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
  }, [
    liveJobStatus,
    liveEnrichment,
    qualifyQueued,
    refreshQueued,
    params.cnpj,
    qc,
    searchId,
  ]);

  useEffect(() => {
    if (!qualifyQueued && !refreshQueued) return;
    const timer = window.setTimeout(() => {
      if (sawQueuedJobRef.current) return;
      setQualifyQueued(false);
      setRefreshQueued(false);
      setQualifyError("A atualização não iniciou. Tente de novo.");
    }, ENRICH_QUEUE_STUCK_MS);
    return () => window.clearTimeout(timer);
  }, [qualifyQueued, refreshQueued]);

  const saveMutation = useMutation({
    mutationFn: async (patch: {
      status?: LeadStatus;
      notas?: string;
      crmStageKey?: FichaMoveKey;
    }) => {
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
          searchId,
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
    mutationFn: async (opts?: { refresh?: boolean }) => {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(searchId ? { searchId } : {}),
          cnpjs: [params.cnpj],
          ...(opts?.refresh ? { refresh: true } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      throwIfBillingGate(res.status, json, openPaywall, "qualify");
      if (!res.ok) {
        throw new Error(
          json.error ??
            (opts?.refresh
              ? "Não foi possível atualizar a qualificação"
              : "Não foi possível qualificar"),
        );
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      void qc.invalidateQueries({
        queryKey: ["lead-stream", normalizeLeadCnpj(params.cnpj)],
      });
      void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
      if (searchId) {
        void qc.invalidateQueries({ queryKey: ["enrich-jobs", searchId] });
        void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      }
    },
    onError: (err: Error) => {
      setQualifyQueued(false);
      setRefreshQueued(false);
      if (isBillingGateError(err)) return;
      setQualifyError(err.message);
    },
  });

  function runQualify(refresh = false) {
    if (
      blockQualifyIfFree(
        billingQuery.data?.balance.enrichAllowed,
        openPaywall,
        {
          trialExpired: billingQuery.data?.balance.trialExpired,
          planCredits: billingQuery.data?.balance.plan,
        },
      )
    ) {
      return;
    }
    setQualifyError(null);
    startJobWatch(refresh ? "refresh" : "first");
    qualifyMutation.mutate(refresh ? { refresh: true } : undefined);
  }
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
      const json = (await res.json()) as {
        error?: string;
        queued?: number;
        recrawl?: boolean;
        enrichment?: LeadEnrichment;
      };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar o site");
      return json;
    },
    onMutate: () => {
      setQualifyError(null);
    },
    onSuccess: (json) => {
      if (json.enrichment) {
        applyEnrichmentPatch(
          json.enrichment,
          json.queued ? "pending" : undefined,
        );
      }
      if (json.queued) startJobWatch("refresh");
      void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      void qc.invalidateQueries({
        queryKey: ["lead-stream", normalizeLeadCnpj(params.cnpj)],
      });
      if (searchId) {
        void qc.invalidateQueries({ queryKey: ["enrich-jobs", searchId] });
        void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      }
    },
    onError: (err: Error) => {
      setQualifyQueued(false);
      setRefreshQueued(false);
      setQualifyError(err.message);
    },
  });
  const correctPresenceMutation = useMutation({
    mutationFn: async (corrections: PresenceCorrection) => {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(searchId ? { searchId } : {}),
          cnpjs: [params.cnpj],
          action: "correct",
          corrections,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        recrawl?: boolean;
        queued?: number;
        enrichment?: LeadEnrichment;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Não foi possível corrigir a qualificação");
      }
      return json;
    },
    onMutate: () => {
      setCorrectError(null);
    },
    onSuccess: (json) => {
      if (json.enrichment) {
        applyEnrichmentPatch(
          json.enrichment,
          json.recrawl && json.queued ? "pending" : undefined,
        );
      }
      if (json.recrawl && json.queued) {
        startJobWatch("refresh");
      } else {
        setRefreshQueued(false);
      }
      void qc.invalidateQueries({ queryKey: leadQueryKey(params.cnpj, searchId) });
      void qc.invalidateQueries({
        queryKey: ["lead-stream", normalizeLeadCnpj(params.cnpj)],
      });
      if (searchId) {
        void qc.invalidateQueries({ queryKey: ["enrich-jobs", searchId] });
        void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      }
    },
    onError: (err: Error) => {
      setQualifyQueued(false);
      setRefreshQueued(false);
      setCorrectError(err.message);
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
          <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-white/5" />
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
  const mapsUrl = leadMapsHref(
    {
      nomeFantasia: est.nome_fantasia,
      razaoSocial: company.razao_social,
      municipio: d.municipioNome,
      uf: est.uf,
      logradouro: est.logradouro,
      numero: est.numero,
    },
    displayEnrichment?.gmb,
  );
  const primaryE164 = primary
    ? toE164(primary.ddd, primary.telefone)
    : null;
  const wa = primaryE164 ? `https://wa.me/${primaryE164}` : null;
  const needsMapsHint =
    primary?.seal === "COMPARTILHADO" || primary?.seal === "NAO_CONFIRMADO";
  const fillCard = "hover:translate-y-0";

  function markLigando() {
    setCalling(true);
    const atEntrada =
      d?.crm?.stageKey === "entrada" || (!d?.crm && d?.status === "novo");
    if (atEntrada || d?.status === "novo") {
      saveMutation.mutate({ status: "ligando" });
    }
  }

  const cityLine = [d.municipioNome, est.uf].filter(Boolean).join(" · ");
  const crmPrompt = fichaCrmPrompt({
    hasDeal: Boolean(d.crm),
    searchSaved: Boolean(d.searchSaved),
    wasQualified: Boolean(displayEnrichment) || Boolean(d.wasQualified),
  });

  function saveStandaloneLead() {
    setSavingPista(true);
    void fetch("/api/empresas/pista", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj: params.cnpj }),
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          searchId?: string;
          error?: string;
        };
        if (!res.ok || !json.searchId) {
          throw new Error(json.error ?? "Não foi possível salvar");
        }
        router.push(leadHref(params.cnpj, json.searchId, from));
      })
      .catch((err: Error) => {
        setSavingPista(false);
        setQualifyError(err.message);
      });
  }

  function openSaveList() {
    setSaveListName((d?.searchNome ?? "").trim() || companyTitle);
    setSaveListError(null);
    setSaveListOpen(true);
  }

  async function submitSaveList() {
    if (!searchId) return;
    const trimmed = saveListName.trim();
    if (!trimmed) return;
    setSavingPista(true);
    setSaveListError(null);
    try {
      const res = await fetch(`/api/search/${searchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: trimmed, saved: true }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      setSaveListOpen(false);
      setSavingPista(false);
      void qc.invalidateQueries({
        queryKey: leadQueryKey(params.cnpj, searchId),
      });
      void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      router.refresh();
    } catch {
      setSavingPista(false);
      setSaveListError("Não foi possível salvar. Tente de novo.");
    }
  }

  const crmAction = d.crm
    ? {
        type: "open" as const,
        href: crmHref({ pipeline: d.crm.pipelineId, deal: d.crm.dealId }),
      }
    : crmPrompt === "entering"
      ? { type: "status" as const, label: COPY.crmEnteringPista }
      : crmPrompt === "qualify"
        ? {
            type: "cta" as const,
            label: COPY.qualificar,
            pendingLabel: "Qualificando…",
            pending: qualifyQueued || qualifyMutation.isPending,
            title: COPY.crmQualifyToEnter,
            onClick: () => runQualify(false),
          }
        : crmPrompt === "save"
          ? {
              type: "cta" as const,
              label: COPY.salvarNaPista,
              pendingLabel: "Salvando…",
              pending: savingPista,
              title: COPY.crmSaveListToEnter,
              onClick: searchId ? openSaveList : saveStandaloneLead,
            }
          : undefined;

  return (
    <AppShell fill title="Ficha" back={back}>
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4">
        <LeadCompanyCard
          title={companyTitle}
          razaoSocial={company.razao_social}
          showRazao={Boolean(est.nome_fantasia)}
          cityLine={cityLine}
          cnaeDescricao={d.cnaeDescricao}
          cnpj={est.cnpj}
          gridPosition={d.gridPosition}
          gridScore={d.gridScore}
          hasAudit={Boolean(displayEnrichment)}
          company={company}
          establishment={est}
          municipioNome={d.municipioNome}
          addressSharedCount={d.addressSharedCount}
          emailSeal={d.emailSeal}
          crmAction={crmAction}
        />

        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <GlassCard
            className={cn(
              "h-full border-white/10 bg-white/[0.03] p-5",
              fillCard,
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              Contato
            </p>
            <p className="mt-1 text-sm font-medium text-podium-white">
              {d.decisor?.nome ?? "Sem sócio no quadro"}
            </p>
            <p className="mt-1 text-xs text-podium-gray">
              {d.decisor
                ? `${d.decisor.qualificacao}${years != null ? ` · sócio há ${years} anos` : ""}`
                : "Nenhum decisor listado na Receita."}
            </p>

            {primary ? (
              <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
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
                    "Telefone"
                  )}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatPhone(primary.ddd, primary.telefone)}
                </p>
                <ContactSealBadge
                  seal={primary.seal}
                  label={primary.label}
                  className="mt-1"
                />
                {primary.sideNote ? (
                  <p className="mt-1 text-xs text-podium-muted">
                    {primary.sideNote}
                  </p>
                ) : null}
                {needsMapsHint ? (
                  <p className="mt-2 text-xs text-podium-muted">
                    Confira no Maps antes de discar.
                  </p>
                ) : null}
                <div className="mt-3">
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
                      className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-podium-gray hover:border-white/25 hover:text-podium-white"
                    >
                      P{next.gridPosition} · {next.nome}
                    </Link>
                  );
                })()}
              </div>
            ) : (
              <p className="mt-4 text-sm text-podium-muted">
                Sem telefone neste lead.
              </p>
            )}

            {others.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                  Outros números
                </p>
                {others.map((c, i) => (
                  <div
                    key={contactKey(c, i)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <a
                        href={`tel:+55${c.ddd}${c.telefone}`}
                        className="text-sm font-medium"
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
                        <p className="mt-0.5 text-xs text-podium-muted">
                          {c.sideNote}
                        </p>
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
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-podium-muted hover:bg-white/5 hover:text-podium-gray"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              ) : (
                <Button size="sm" variant="ghost" disabled className="gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
              )}
              {needsMapsHint ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-podium-muted hover:bg-white/5 hover:text-podium-gray"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Conferir no Maps
                </a>
              ) : null}
            </div>

            <SociosPanel
              embedded
              decisorNome={d.decisor?.nome}
              socios={d.socios ?? []}
              enrichment={displayEnrichment}
            />
          </GlassCard>

          <DigitalAuditPanel
            className="h-full border-white/10 bg-white/[0.03]"
            enrichment={displayEnrichment}
            qualifying={
              !hasCompleteAudit &&
              (qualifyQueued ||
                liveJobStatus === "pending" ||
                liveJobStatus === "running" ||
                (liveEnrichment != null &&
                  enrichmentStage(liveEnrichment) !== "complete"))
            }
            refreshing={refreshQueued}
            qualifyPending={qualifyMutation.isPending}
            qualifyError={qualifyError}
            onQualify={() => runQualify(false)}
            onRefresh={
              hasCompleteAudit ? () => runQualify(true) : undefined
            }
            mapsUrl={mapsUrl}
            confirmPending={confirmSiteMutation.isPending}
            onConfirmSite={(domain) =>
              confirmSiteMutation.mutate({ action: "confirm", domain })
            }
            onRejectSite={(domain) =>
              confirmSiteMutation.mutate({ action: "reject", domain })
            }
            correctPending={correctPresenceMutation.isPending}
            correctError={correctError}
            onCorrectPresence={(corrections) =>
              correctPresenceMutation.mutate(corrections)
            }
          />
        </div>

        <AnatomyCard
          market={d.market}
          uf={est.uf}
          decisorNome={d.decisor?.nome}
          volta={
            statsQuery.data
              ? `${statsQuery.data.hoje}/${statsQuery.data.meta} ligações`
              : null
          }
        />

        <LeadStatusStrip
          key={params.cnpj}
          crm={d.crm ?? null}
          searchSaved={Boolean(d.searchSaved)}
          wasQualified={Boolean(displayEnrichment) || Boolean(d.wasQualified)}
          notas={d.notas}
          recordPending={recordCall.isPending}
          onStage={(crmStageKey) => saveMutation.mutate({ crmStageKey })}
          onRecordCall={() => recordCall.mutate()}
          onNotasBlur={(notas) => saveMutation.mutate({ notas })}
          callAction={
            primary ? (
              <CallButton
                telHref={`tel:+55${primary.ddd}${primary.telefone}`}
                connection={callConnection}
                cnpj={params.cnpj}
                searchId={searchId}
                to={primaryE164 ? `+${primaryE164}` : undefined}
                variant="cockpit"
                onCalled={markLigando}
              />
            ) : null
          }
        />
      </div>
      <SaveListDialog
        open={saveListOpen}
        saved={false}
        name={saveListName}
        pending={savingPista}
        error={saveListError}
        onClose={() => {
          if (savingPista) return;
          setSaveListOpen(false);
          setSaveListError(null);
        }}
        onNameChange={setSaveListName}
        onSubmit={() => {
          void submitSaveList();
        }}
      />
    </AppShell>
  );
}
