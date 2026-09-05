"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Check, Send, SlidersHorizontal, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CallButton } from "@/components/CallButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactSealBadge } from "@/components/ContactSeal";
import { EmptyValue } from "@/components/EmptyValue";
import { GlassCard } from "@/components/GlassCard";
import { ListSummaryBadges } from "@/components/ListSummaryBadges";
import { PositionBadge } from "@/components/PositionBadge";
import { SaveListDialog } from "@/components/SaveListDialog";
import { SaveToCrmTelemetry } from "@/components/SaveToCrmTelemetry";
import { SectionTitle } from "@/components/SectionTitle";
import { QualifyPendingButton, SelectToggle } from "@/components/SelectToggle";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { usePaywall } from "@/components/PaywallDialog";
import { COPY } from "@/lib/copy";
import { DEFAULT_CALL_GOAL } from "@/lib/pilot-profile";
import { CONNECTIONS_STANDBY } from "@/lib/integrations/standby";
import { gridBack, largadaEditHref, leadHref, parseGridFrom, crmHref } from "@/lib/back";
import { ENRICH_CREDIT_COST, EXPORT_CREDIT_COST, creditsEach } from "@/lib/billing/catalog";
import {
  blockQualifyIfFree,
  isBillingGateError,
  throwIfBillingGate,
} from "@/lib/billing/paywall";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import { useMinWidth } from "@/hooks/useMinWidth";
import { sealLabel } from "@/lib/seal-display";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatCnae, formatPhone, formatPorte } from "@/lib/format";
import type { EnrichmentJob, GridRow, Profile, Search } from "@/lib/types";
import {
  ENRICH_QUEUE_STUCK_MS,
  enrichJobsPollInterval,
  enrichQueueStuck,
  isGridRowQualified,
  isGridRowQualifying,
} from "@/lib/grid-qualify";
import {
  fetchLeadDossier,
  gridRowToPreview,
  leadPreviewKey,
  leadQueryKey,
  normalizeLeadCnpj,
} from "@/lib/lead-query";
import { ExportMenu } from "@/components/ExportDownload";
import {
  ExportConfirmDialog,
  useExportCostConfirm,
} from "@/components/ExportConfirmDialog";
import { GridMoreMenu } from "@/components/GridMoreMenu";
import { formatEventWhen } from "@/lib/crm/events";
import { qualifyCrmHint, type PublicCrmBridge } from "@/lib/crm/bridge";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import type { IntegrationJobRecord } from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

async function fetchPage(searchId: string, cursor: number) {
  const res = await fetch(`/api/grid/${searchId}?cursor=${cursor}&limit=50`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error("Não foi possível carregar a lista");
  return res.json() as Promise<{
    rows: GridRow[];
    nextCursor: number | null;
    total: number;
    unaudited: number;
  }>;
}

type EnrichBody = {
  cnpjs?: string[];
  scope?: "first_unaudited" | "all_unaudited";
  limit?: number;
};

const QUALIFY_BATCH_SIZES = [10, 20, 50] as const;

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input"))
  );
}

function jobChip(status: GridRow["enrichmentStatus"]) {
  if (status === "pending") return "na fila";
  if (status === "running") return "cruzando";
  if (status === "done" || status === "skipped") return "qualificado";
  if (status === "failed") return "não deu";
  return null;
}

function isRowQualifying(row: GridRow, pendingCnpjs: Set<string>) {
  return isGridRowQualifying(row, pendingCnpjs);
}

function resolveQualifyTargets(body: EnrichBody, rows: GridRow[]): string[] {
  if (body.cnpjs?.length) return body.cnpjs;
  const unaudited = rows.filter(
    (r) =>
      !r.hasAudit &&
      r.enrichmentStatus !== "done" &&
      r.enrichmentStatus !== "skipped" &&
      !isRowQualifying(r, new Set()),
  );
  if (body.scope === "first_unaudited") {
    return unaudited.slice(0, body.limit ?? 10).map((r) => r.cnpj);
  }
  if (body.scope === "all_unaudited") {
    return unaudited.map((r) => r.cnpj);
  }
  return [];
}

function rowCompanyMeta(row: GridRow): string {
  const parts = [`${row.municipio}/${row.uf}`];
  const cnae = formatCnae(row.cnaeCodigo);
  if (cnae) parts.push(cnae);
  if (row.porte) {
    const porte = formatPorte(row.porte);
    if (porte !== "NÃO ENCONTRADO") parts.push(porte);
  }
  return parts.join(" · ");
}

function rowSourceLabel(row: GridRow, qualifying: boolean): string {
  if (qualifying) {
    return jobChip(row.enrichmentStatus) ?? "cruzando";
  }
  return jobChip(row.enrichmentStatus) ?? (row.hasAudit ? "Qualificado" : "Receita");
}

function RowSourceStatus({
  row,
  qualifying,
  className,
}: {
  row: GridRow;
  qualifying: boolean;
  className?: string;
}) {
  const label = rowSourceLabel(row, qualifying);
  const qualified = isGridRowQualified(row, qualifying);
  if (qualified) return null;
  return (
    <p
      className={cn(
        "text-[10px] uppercase tracking-wide text-podium-muted",
        className,
      )}
    >
      {label}
    </p>
  );
}

function GridCompanyLink({
  row,
  searchId,
  from,
  onWarm,
  className,
}: {
  row: GridRow;
  searchId: string;
  from: ReturnType<typeof parseGridFrom>;
  onWarm: () => void;
  className?: string;
}) {
  const name = displayCompanyName(row.nomeFantasia, row.razaoSocial);
  return (
    <Link
      href={leadHref(row.cnpj, searchId, from)}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      onClick={onWarm}
      title={
        row.nomeFantasia
          ? `${row.nomeFantasia} · ${row.razaoSocial}`
          : row.razaoSocial
      }
      className={cn(
        "truncate font-medium hover:text-podium-yellow focus-visible:outline-none focus-visible:text-podium-yellow",
        className,
      )}
    >
      {name}
    </Link>
  );
}

function GridRowActions({
  row,
  searchId,
  callConnection,
  selected,
  qualifying,
  canRemove,
  onToggle,
  onRemove,
}: {
  row: GridRow;
  searchId: string;
  callConnection: ReturnType<typeof pickCallConnection>;
  selected: boolean;
  qualifying: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [dialed, setDialed] = useState(false);
  const telHref = row.telefone ? `tel:+55${row.telefone}` : null;
  const name = displayCompanyName(row.nomeFantasia, row.razaoSocial);
  const qualified = isGridRowQualified(row, qualifying);
  const phoneLabel = formatPhone(
    row.telefone?.slice(0, 2) ?? null,
    row.telefone?.slice(2) ?? null,
  );
  const calledToday = row.calledToday || dialed;
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {qualified ? (
        <div className="flex items-center gap-1">
          <Badge
            variant="success"
            className="h-6 shrink-0 px-1.5 text-[10px] uppercase"
          >
            Qualificado
          </Badge>
          {row.inCrm ? (
            <Badge
              variant="accent"
              className="h-6 shrink-0 px-1.5 text-[10px] uppercase"
            >
              {COPY.crmOnGrid}
            </Badge>
          ) : null}
        </div>
      ) : qualifying ? (
        <QualifyPendingButton ariaLabel={`Qualificando ${name}`} />
      ) : (
        <SelectToggle
          pressed={selected}
          onToggle={onToggle}
          idleLabel="Selecionar"
          pressedLabel="Selecionada"
          className="px-2"
          ariaLabel={
            selected ? `Selecionada ${name}` : `Selecionar ${name}`
          }
        />
      )}
      <CallButton
        telHref={telHref}
        connection={callConnection}
        cnpj={row.cnpj}
        searchId={searchId}
        to={row.telefone ? `+55${row.telefone}` : undefined}
        variant="grid"
        className="px-2"
        titleHint={COPY.callDialHint}
        companyName={name}
        phoneLabel={phoneLabel}
        onCalled={() => setDialed(true)}
      />
      {calledToday ? (
        <Badge
          variant="accent"
          title={row.calledAt ? formatEventWhen(row.calledAt) : COPY.callConfirmHint}
          className="h-6 shrink-0 px-1.5 text-[10px] uppercase"
        >
          {COPY.gridCalledToday}
        </Badge>
      ) : null}
      {canRemove ? (
        <button
          type="button"
          title={COPY.tirarDaLista}
          aria-label={`${COPY.tirarDaLista} ${name}`}
          onClick={onRemove}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-podium-muted hover:bg-white/5 hover:text-podium-yellow"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export default function GridPage() {
  const params = useParams<{ searchId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchId = params.searchId;
  const from = parseGridFrom(searchParams.get("from"));
  const qc = useQueryClient();
  const { openPaywall } = usePaywall();
  const billingQuery = useBillingMe();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Não foi possível carregar o perfil");
      return (await res.json()) as Profile;
    },
  });
  const callGoal = profileQuery.data?.meta_ligacoes_dia || DEFAULT_CALL_GOAL;
  const [listName, setListName] = useState("");
  const [renamed, setRenamed] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingCnpjs, setPendingCnpjs] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [removingCnpj, setRemovingCnpj] = useState<string | null>(null);
  const [askRemoveCnpj, setAskRemoveCnpj] = useState<string | null>(null);
  const [queueStuck, setQueueStuck] = useState(false);
  const [creditHint, setCreditHint] = useState<string | null>(null);
  const [crmHint, setCrmHint] = useState<string | null>(null);
  const [crmPipelineId, setCrmPipelineId] = useState<string | null>(null);
  const rowsRef = useRef<GridRow[]>([]);
  const pendingOnlySinceRef = useRef<number | null>(null);
  const desktop = useMinWidth(1024);

  const searchQuery = useQuery({
    queryKey: ["search", searchId],
    queryFn: async () => {
      const res = await fetch(`/api/search/${searchId}`);
      if (!res.ok) throw new Error("Busca não encontrada");
      return (await res.json()) as Search;
    },
  });

  const search = searchQuery.data;

  useEffect(() => {
    if (search?.nome) setListName(search.nome);
  }, [search?.nome]);

  const saveMutation = useMutation<Search, Error, { nome: string; saved?: boolean }>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/search/${searchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      return (await res.json()) as Search;
    },
    onSuccess: (data, variables) => {
      qc.setQueryData(["search", searchId], data);
      setSaveOpen(false);
      if (variables.saved == null) {
        setRenamed(true);
        setTimeout(() => setRenamed(false), 1800);
      }
      if (variables.saved === true) {
        setCrmHint(COPY.crmEnteringPista);
        setCrmPipelineId(null);
        void fetch("/api/session/catch-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchId }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then(
            (
              catchUp: {
                created?: number;
                pipelineId?: string | null;
              } | null,
            ) => {
              if (catchUp?.pipelineId) setCrmPipelineId(catchUp.pipelineId);
              if (catchUp?.created) {
                setCrmHint(
                  catchUp.created === 1
                    ? COPY.crmCatchUpToastOne
                    : COPY.crmCatchUpToastMany.replace(
                        "{n}",
                        String(catchUp.created),
                      ),
                );
              } else if (catchUp?.pipelineId) {
                setCrmHint(COPY.crmOnGrid);
              }
            },
          )
          .catch(() => undefined)
          .finally(() => {
            void qc.invalidateQueries({ queryKey: ["grid", searchId] });
            void qc.invalidateQueries({ queryKey: ["lead"] });
            router.refresh();
          });
      }
    },
  });

  async function removeFromList(cnpj: string) {
    if (removingCnpj) return;
    setRemovingCnpj(cnpj);
    try {
      const res = await fetch(
        `/api/search/${searchId}/leads/${cnpj}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Não foi possível tirar da lista");
      void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      void qc.invalidateQueries({ queryKey: ["search", searchId] });
      setAskRemoveCnpj(null);
    } finally {
      setRemovingCnpj(null);
    }
  }

  const connectionsQuery = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/connections");
      if (!res.ok) return { connections: [] as IntegrationConnectionPublic[] };
      return (await res.json()) as { connections: IntegrationConnectionPublic[] };
    },
  });
  const callConnection = pickCallConnection(
    connectionsQuery.data?.connections ?? [],
  );

  const pushJobsQuery = useQuery({
    queryKey: ["integration-jobs", searchId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/jobs?searchId=${searchId}`);
      return (await res.json()) as { jobs: IntegrationJobRecord[] };
    },
    refetchInterval: (q) => {
      const list = q.state.data?.jobs ?? [];
      return list.some((j) => j.status === "pending" || j.status === "running")
        ? 3000
        : false;
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/integrations/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, connectionId: id }),
      });
      const body = (await res.json()) as {
        error?: string;
        needed?: number;
        available?: number;
        charged?: number;
        skipped?: number;
      };
      throwIfBillingGate(res.status, body, openPaywall, "crm_push");
      if (!res.ok) throw new Error(body.error ?? "Não foi possível enviar");
      return body;
    },
    onSuccess: (body) => {
      setCreditHint(
        body.charged
          ? `${body.charged} crédito(s) nesta lista` +
              (body.skipped ? ` · ${body.skipped} já estavam pagos` : "")
          : body.skipped
            ? "Já estava pago — reenvio grátis"
            : null,
      );
      void qc.invalidateQueries({ queryKey: ["integration-jobs", searchId] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
    },
    onError: (err: Error) => {
      if (isBillingGateError(err)) return;
      setCreditHint(err.message);
    },
  });

  const exportCost = useExportCostConfirm({
    searchId,
    onPush: (id) => pushMutation.mutateAsync(id),
  });

  const jobsQuery = useQuery({
    queryKey: ["enrich-jobs", searchId],
    queryFn: async () => {
      const res = await fetch(`/api/enrich?searchId=${searchId}`);
      return (await res.json()) as { jobs: EnrichmentJob[] };
    },
    refetchInterval: (q) => enrichJobsPollInterval(q.state.data?.jobs ?? []),
  });

  const enrichMutation = useMutation({
    mutationFn: async (body: EnrichBody) => {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, ...body }),
      });
      const json = (await res.json()) as {
        error?: string;
        upgradeUrl?: string;
        crmBridge?: PublicCrmBridge | null;
      };
      throwIfBillingGate(res.status, json, openPaywall, "qualify");
      if (!res.ok) throw new Error(json.error ?? "Não foi possível qualificar");
      return json;
    },
    onMutate: (body) => {
      const targets = resolveQualifyTargets(body, rowsRef.current);
      if (targets.length) {
        setPendingCnpjs((prev) => {
          const next = new Set(prev);
          for (const cnpj of targets) next.add(cnpj);
          return next;
        });
      }
      return { targets };
    },
    onSuccess: (json) => {
      setCreditHint(null);
      const shown = qualifyCrmHint(Boolean(search?.saved), json.crmBridge ?? null);
      setCrmHint(shown.hint);
      setCrmPipelineId(shown.pipelineId);
      setSelected(new Set());
      setConfirmAll(false);
      void qc.invalidateQueries({ queryKey: ["enrich-jobs", searchId] });
      void qc.invalidateQueries({ queryKey: ["grid", searchId] });
      void qc.invalidateQueries({ queryKey: ["lead"] });
      void qc.invalidateQueries({ queryKey: ["lead-stream"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY });
    },
    onError: (err: Error, _body, ctx) => {
      if (ctx?.targets.length) {
        setPendingCnpjs((prev) => {
          const next = new Set(prev);
          for (const cnpj of ctx.targets) next.delete(cnpj);
          return next;
        });
      }
      if (isBillingGateError(err)) return;
      setCreditHint(err.message);
    },
  });

  function requestQualify(body: EnrichBody) {
    if (blockQualifyIfFree(billingQuery.data?.balance.enrichAllowed, openPaywall, {
      trialExpired: billingQuery.data?.balance.trialExpired,
      planCredits: billingQuery.data?.balance.plan,
    })) {
      return;
    }
    enrichMutation.mutate(body);
  }

  const query = useInfiniteQuery({
    queryKey: ["grid", searchId],
    queryFn: ({ pageParam }) => fetchPage(searchId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const jobs = jobsQuery.data?.jobs ?? [];
  const doneJobs = jobs.filter((j) => j.status === "done" || j.status === "skipped").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const activeJobs = jobs.filter(
    (j) => j.status === "pending" || j.status === "running",
  ).length;
  const pendingJobs = jobs.filter((j) => j.status === "pending").length;

  useEffect(() => {
    const pending = jobs.some((j) => j.status === "pending");
    const running = jobs.some((j) => j.status === "running");
    if (pending && !running) {
      if (pendingOnlySinceRef.current == null) {
        pendingOnlySinceRef.current = Date.now();
      }
      setQueueStuck(
        enrichQueueStuck(jobs, pendingOnlySinceRef.current),
      );
      const elapsed = Date.now() - pendingOnlySinceRef.current;
      const wait = Math.max(0, ENRICH_QUEUE_STUCK_MS - elapsed);
      const id = window.setTimeout(
        () => setQueueStuck(true),
        wait,
      );
      return () => window.clearTimeout(id);
    }
    pendingOnlySinceRef.current = null;
    setQueueStuck(false);
  }, [jobs]);

  const jobByCnpj = useMemo(() => {
    const map = new Map<string, EnrichmentJob>();
    for (const job of jobs) map.set(job.cnpj, job);
    return map;
  }, [jobs]);

  const rows = useMemo(() => {
    const raw = query.data?.pages.flatMap((p) => p.rows) ?? [];
    return raw.map((row) => {
      const job = jobByCnpj.get(row.cnpj);
      if (!job) return row;
      const done = job.status === "done" || job.status === "skipped";
      return {
        ...row,
        enrichmentStatus: job.status,
        hasAudit: done ? true : row.hasAudit,
      };
    });
  }, [query.data, jobByCnpj]);
  rowsRef.current = rows;

  const total = query.data?.pages[0]?.total ?? 0;
  const unaudited = query.data?.pages[0]?.unaudited ?? 0;
  const canExport = total > 0 && unaudited < total;

  const visibleUnaudited = useMemo(
    () => rows.filter((r) => !r.hasAudit && !isRowQualifying(r, pendingCnpjs)),
    [rows, pendingCnpjs],
  );
  const selectedCount = selected.size;
  const allVisibleSelected =
    visibleUnaudited.length > 0 &&
    visibleUnaudited.every((r) => selected.has(r.cnpj));
  const selectedCost = selectedCount * ENRICH_CREDIT_COST;
  const allCost = unaudited * ENRICH_CREDIT_COST;
  const exportCostHint = `${EXPORT_CREDIT_COST} créditos por empresa`;
  const extraBatchSizes = QUALIFY_BATCH_SIZES.filter((size) => size !== callGoal);
  const destinations = (connectionsQuery.data?.connections ?? []).filter(
    (c) => c.status === "active" && c.provider === "webhook",
  );
  const lastPush = (pushJobsQuery.data?.jobs ?? [])[0];
  function renderSendControls() {
    if (destinations.length === 0) {
      if (CONNECTIONS_STANDBY) return null;
      return (
        <Link
          href="/conexoes"
          className={buttonClassName({
            variant: "secondary",
            size: "sm",
          })}
        >
          <Send className="h-3.5 w-3.5" />
          Conectar envio
        </Link>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={connectionId || destinations[0]?.id || ""}
          onChange={(e) => setConnectionId(e.target.value)}
          className="h-7 min-w-0 rounded-md border border-white/15 bg-podium-panel px-2.5 text-xs text-podium-white"
        >
          {destinations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name ?? c.provider}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="primary"
          disabled={pushMutation.isPending || rows.length === 0 || !canExport}
          onClick={() =>
            exportCost.askPush(connectionId || destinations[0]!.id)
          }
          className="gap-1.5"
          title={canExport ? exportCostHint : COPY.exportNeedsQualify}
        >
          <Send className="h-3.5 w-3.5" />
          Enviar
        </Button>
        {lastPush ? (
          <span className="text-[11px] text-podium-muted">
            {lastPush.status === "done"
              ? "enviado"
              : lastPush.status === "failed"
                ? lastPush.last_error ?? "falhou"
                : "enviando"}
          </span>
        ) : null}
      </div>
    );
  }

  const prevDoneJobs = useRef<number | null>(null);
  const prevDoneCnpjs = useRef<Set<string>>(new Set());
  useEffect(() => {
    prevDoneJobs.current = null;
    prevDoneCnpjs.current = new Set();
    setPendingCnpjs(new Set());
  }, [searchId]);
  useEffect(() => {
    if (jobs.length === 0) return;
    const doneCnpjs = jobs
      .filter((j) => j.status === "done" || j.status === "skipped")
      .map((j) => normalizeLeadCnpj(j.cnpj));
    if (prevDoneJobs.current == null) {
      prevDoneJobs.current = doneJobs;
      prevDoneCnpjs.current = new Set(doneCnpjs);
      return;
    }
    if (doneJobs <= prevDoneJobs.current) return;
    prevDoneJobs.current = doneJobs;
    const newlyDone = doneCnpjs.filter((c) => !prevDoneCnpjs.current.has(c));
    prevDoneCnpjs.current = new Set(doneCnpjs);
    void qc.invalidateQueries(
      { queryKey: ["grid", searchId] },
      { cancelRefetch: false },
    );
    for (const cnpj of newlyDone) {
      void qc.invalidateQueries({ queryKey: leadQueryKey(cnpj, searchId) });
      void qc.invalidateQueries({ queryKey: ["lead-stream", cnpj] });
    }
  }, [doneJobs, jobs, qc, searchId]);

  useEffect(() => {
    setPendingCnpjs((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const cnpj of prev) {
        const row = rows.find((r) => r.cnpj === cnpj);
        const status = jobByCnpj.get(cnpj)?.status ?? row?.enrichmentStatus;
        if (
          row?.hasAudit ||
          status === "pending" ||
          status === "running" ||
          status === "done" ||
          status === "skipped" ||
          status === "failed"
        ) {
          next.delete(cnpj);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [jobByCnpj, rows]);

  function toggleRow(row: GridRow) {
    if (row.hasAudit || isRowQualifying(row, pendingCnpjs)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.cnpj)) next.delete(row.cnpj);
      else next.add(row.cnpj);
      return next;
    });
  }

  function warmLead(row: GridRow) {
    qc.setQueryData(leadPreviewKey(row.cnpj), gridRowToPreview(row));
    const key = leadQueryKey(row.cnpj, searchId);
    // After qualify on the grid, force a fresh dossier so the ficha shows the audit.
    if (row.hasAudit || row.enrichmentStatus === "done") {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({
        queryKey: ["lead-stream", normalizeLeadCnpj(row.cnpj)],
      });
    }
    void qc.prefetchQuery({
      queryKey: key,
      queryFn: () => fetchLeadDossier(row.cnpj, searchId),
      staleTime: row.hasAudit ? 0 : 30_000,
    });
  }

  function activateRow(row: GridRow) {
    warmLead(row);
    router.push(leadHref(row.cnpj, searchId, from));
  }

  function onRowClick(e: MouseEvent, row: GridRow) {
    if (isInteractiveTarget(e.target)) return;
    activateRow(row);
  }

  function toggleVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of visibleUnaudited) next.delete(r.cnpj);
      } else {
        for (const r of visibleUnaudited) next.add(r.cnpj);
      }
      return next;
    });
  }

  async function markAllUnaudited() {
    setMarkingAll(true);
    try {
      const res = await fetch(`/api/grid/${searchId}?unauditedIds=1`);
      const json = (await res.json()) as { cnpjs?: string[] };
      setSelected(new Set(json.cnpjs ?? []));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <AppShell title="Grid" back={gridBack(from, searchId)}>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle>Grid de resultados</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            {searchQuery.isLoading ? (
              <div className="h-7 w-24 animate-pulse rounded-md bg-white/5" />
            ) : search?.saved ? (
              <div className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSaveOpen(true)}
                  className="border-podium-success/30 bg-podium-success/15 text-podium-success hover:border-podium-success/40 hover:bg-podium-success/25 hover:text-podium-success"
                >
                  <Check className="h-3.5 w-3.5" />
                  {renamed ? "Nome atualizado" : COPY.listaSalva}
                </Button>
                <Link
                  href="/listas"
                  className="text-[11px] font-medium text-podium-muted hover:text-podium-yellow"
                >
                  Minhas listas
                </Link>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setSaveOpen(true)}
                className="recommend-pulse"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                {COPY.salvarLista}
              </Button>
            )}
            <Link
              href={largadaEditHref(searchId, from)}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {COPY.ajustarNichoQualidade}
            </Link>
          </div>
        </div>

        {!searchQuery.isLoading && search && !search.saved ? (
          <SaveToCrmTelemetry onSave={() => setSaveOpen(true)} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-baseline gap-1.5 rounded-md bg-white/5 px-2.5 py-1">
            <span className="text-sm font-semibold tabular-nums leading-none">
              {total}
            </span>
            <span className="text-[11px] font-medium text-podium-muted">leads</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1">
            <span className="inline-flex items-center justify-center rounded-md bg-podium-yellow px-1.5 py-0.5 text-[10px] font-medium text-podium-navy">
              P1
            </span>
            <span className="text-[11px] font-medium text-podium-gray">
              {COPY.gridLigarOrdem}
            </span>
          </span>
          {search?.filtros ? (
            <ListSummaryBadges
              filters={search.filtros}
              includeSemContabil
              className="contents"
            />
          ) : null}
        </div>

        {jobs.length > 0 ? (
          <p className="text-xs text-podium-gray">
            {queueStuck
              ? `${COPY.filaWorkerOcupado} · ${pendingJobs} na frente`
              : activeJobs > 0 &&
                  !jobs.some((j) => j.status === "running")
                ? `${COPY.filaQualificando} ${doneJobs}/${jobs.length}`
                : `Qualificando ${doneJobs}/${jobs.length}`}
            {failedJobs ? ` · ${failedJobs} falhas` : ""}
            {activeJobs && jobs.some((j) => j.status === "running")
              ? " · em andamento"
              : ""}
          </p>
        ) : null}

        <div className="flex items-center gap-2 md:hidden">
          <Button
            size="sm"
            variant="primary"
            title={creditsEach(ENRICH_CREDIT_COST)}
            disabled={enrichMutation.isPending || unaudited === 0}
            onClick={() =>
              requestQualify({ scope: "first_unaudited", limit: callGoal })
            }
            className="min-w-0 flex-1"
          >
            {COPY.qualificar} ({callGoal})
          </Button>
          <GridMoreMenu
            qualifyPending={enrichMutation.isPending}
            unaudited={unaudited}
            allCost={allCost}
            confirmAll={confirmAll}
            batchSizes={extraBatchSizes}
            onQualifyBatch={(limit) =>
              requestQualify({ scope: "first_unaudited", limit })
            }
            onQualifyAll={() => requestQualify({ scope: "all_unaudited" })}
            onAskConfirmAll={() => setConfirmAll(true)}
            canExport={canExport}
            exportCostHint={exportCostHint}
            onPickFormat={exportCost.askExport}
            sendSection={renderSendControls()}
          />
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          <Button
            size="sm"
            variant="primary"
            title={creditsEach(ENRICH_CREDIT_COST)}
            disabled={enrichMutation.isPending || unaudited === 0}
            onClick={() =>
              requestQualify({ scope: "first_unaudited", limit: callGoal })
            }
          >
            {COPY.qualificarMetaHoje} ({callGoal})
          </Button>
          {extraBatchSizes.map((size) => (
            <Button
              key={size}
              size="sm"
              variant="secondary"
              title={creditsEach(ENRICH_CREDIT_COST)}
              disabled={enrichMutation.isPending || unaudited === 0}
              onClick={() =>
                requestQualify({ scope: "first_unaudited", limit: size })
              }
            >
              Qualificar {size}
            </Button>
          ))}
          {confirmAll ? (
            <Button
              size="sm"
              variant="primary"
              disabled={enrichMutation.isPending || unaudited === 0}
              onClick={() => requestQualify({ scope: "all_unaudited" })}
            >
              Confirmar {unaudited} · {allCost} créditos
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              title={creditsEach(ENRICH_CREDIT_COST)}
              disabled={unaudited === 0}
              onClick={() => setConfirmAll(true)}
            >
              Qualificar a lista inteira ({unaudited})
            </Button>
          )}
          {renderSendControls()}
          <ExportMenu
            disabled={!canExport}
            disabledHint={COPY.exportNeedsQualify}
            costHint={exportCostHint}
            onPickFormat={exportCost.askExport}
          />
        </div>
        <p className="hidden text-[11px] text-podium-muted md:block">
          Exportar a planilha custa {EXPORT_CREDIT_COST} créditos por empresa já
          qualificada. {COPY.exportCrmIncluso}
        </p>
      </div>
      {creditHint ? (
        <p className="mb-4 text-sm text-podium-yellow">{creditHint}</p>
      ) : null}
      {crmHint ? (
        <p className="mb-4 text-sm text-podium-muted">
          {crmHint}
          {crmPipelineId ? (
            <>
              {" · "}
              <Link
                href={crmHref({ pipeline: crmPipelineId })}
                className="font-semibold text-podium-yellow hover:underline"
              >
                {COPY.crmOpenPista}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <SaveListDialog
        open={saveOpen}
        saved={Boolean(search?.saved)}
        name={listName}
        pending={saveMutation.isPending}
        error={saveMutation.isError ? saveMutation.error.message : null}
        onClose={() => {
          setSaveOpen(false);
          saveMutation.reset();
          if (search?.nome) setListName(search.nome);
        }}
        onNameChange={setListName}
        onSubmit={() =>
          saveMutation.mutate({
            nome: listName.trim(),
            ...(search?.saved ? {} : { saved: true }),
          })
        }
      />

      <ExportConfirmDialog {...exportCost.dialogProps} />

      <ConfirmDialog
        open={Boolean(askRemoveCnpj)}
        title={COPY.tirarDaLista}
        body={COPY.tirarDaListaConfirm}
        confirmLabel={COPY.tirarDaLista}
        pendingLabel={COPY.tirarDaListaPending}
        pending={Boolean(removingCnpj)}
        onClose={() => {
          if (removingCnpj) return;
          setAskRemoveCnpj(null);
        }}
        onConfirm={() => {
          if (askRemoveCnpj) void removeFromList(askRemoveCnpj);
        }}
      />

      {query.isLoading ? (
        <div className="space-y-3">
          {desktop ? (
            <div className="h-64 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <>
              <div className="h-24 animate-pulse rounded-lg bg-white/5" />
              <div className="h-24 animate-pulse rounded-lg bg-white/5" />
            </>
          )}
        </div>
      ) : query.isError && !query.data ? (
        <GlassCard className="p-5 text-sm text-podium-muted">
          <p>Não foi possível carregar a lista. Tente de novo.</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void query.refetch()}
            className="mt-3"
          >
            Tentar de novo
          </Button>
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard className="p-5 text-sm text-podium-muted">
          <p>{COPY.gridEmptyAdjust}</p>
          <Link
            href={largadaEditHref(searchId, from)}
            className={cn(
              buttonClassName({ variant: "primary", size: "sm" }),
              "mt-3",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {COPY.ajustarNichoQualidade}
          </Link>
        </GlassCard>
      ) : (
        <>
      {unaudited > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            disabled={markingAll}
            onClick={() => void markAllUnaudited()}
            className="text-[11px] font-medium text-podium-yellow hover:underline disabled:opacity-40"
          >
            {markingAll
              ? "Selecionando…"
              : `Selecionar tudo (${unaudited} só na Receita)`}
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setSelected(new Set())}
            className="text-[11px] font-medium text-podium-yellow hover:underline disabled:opacity-40"
          >
            Desmarcar tudo
          </button>
        </div>
      ) : null}

      {desktop ? (
      <GlassCard className="hover:translate-y-0">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[18rem]" />
            <col className="w-[10rem]" />
            <col />
            <col className="w-[11.5rem]" />
            <col className="w-[12rem]" />
          </colgroup>
          <thead className="sticky top-14 z-20 border-b border-white/10 bg-podium-panel/95 text-xs uppercase tracking-wide text-podium-muted backdrop-blur-xl">
            <tr>
              <th className="px-2 py-2">
                <div className="flex flex-col items-start gap-1">
                  <span>Ações</span>
                  <SelectToggle
                    variant="text"
                    pressed={allVisibleSelected}
                    disabled={visibleUnaudited.length === 0}
                    onToggle={toggleVisible}
                    idleLabel="Selecionar visíveis"
                    pressedLabel="Limpar visíveis"
                  />
                </div>
              </th>
              <th className="px-2 py-2">Pos.</th>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Decisor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ddd = row.telefone?.slice(0, 2) ?? null;
              const tel = row.telefone?.slice(2) ?? null;
              const qualifying = isRowQualifying(row, pendingCnpjs);
              const qualified = isGridRowQualified(row, qualifying);
              return (
                <tr
                  key={row.cnpj}
                  onClick={(e) => onRowClick(e, row)}
                  onPointerEnter={() => warmLead(row)}
                  className={cn(
                    "cursor-pointer border-b border-white/5 [contain-intrinsic-size:auto_3.25rem] [content-visibility:auto] hover:bg-white/[0.03]",
                    selected.has(row.cnpj) && "bg-podium-yellow/[0.04]",
                  )}
                >
                  <td className="whitespace-nowrap px-2 py-2 align-middle">
                    <GridRowActions
                      row={row}
                      searchId={searchId}
                      callConnection={callConnection}
                      selected={selected.has(row.cnpj)}
                      qualifying={qualifying}
                      canRemove={Boolean(search?.saved)}
                      onToggle={() => toggleRow(row)}
                      onRemove={() => setAskRemoveCnpj(row.cnpj)}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <PositionBadge
                      position={row.gridPosition}
                      score={row.gridScore}
                      hasAudit={qualified}
                    />
                    <RowSourceStatus
                      row={row}
                      qualifying={qualifying}
                      className="mt-1"
                    />
                  </td>
                  <td className="min-w-0 px-3 py-2 align-middle">
                    <GridCompanyLink
                      row={row}
                      searchId={searchId}
                      from={from}
                      onWarm={() => warmLead(row)}
                      className="block"
                    />
                    <p
                      className="truncate text-xs text-podium-muted"
                      title={row.cnaeDescricao}
                    >
                      {rowCompanyMeta(row)}
                    </p>
                    {row.email ? (
                      <p
                        className="mt-0.5 truncate text-[11px] text-podium-muted/80"
                        title={row.email}
                      >
                        {row.email}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {formatPhone(ddd, tel) ? (
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">
                          {formatPhone(ddd, tel)}
                        </p>
                        <ContactSealBadge
                          compact
                          seal={row.seal}
                          label={sealLabel(row.seal, row.sharedCount)}
                          className="mt-0.5"
                        />
                      </div>
                    ) : (
                      <EmptyValue />
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <p className="break-words leading-snug">
                      {row.decisorNome ?? <EmptyValue />}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
      ) : (
      <div className="space-y-3">
        {rows.map((row) => {
          const ddd = row.telefone?.slice(0, 2) ?? null;
          const tel = row.telefone?.slice(2) ?? null;
          const qualifying = isRowQualifying(row, pendingCnpjs);
          const qualified = isGridRowQualified(row, qualifying);
          return (
            <GlassCard
              key={row.cnpj}
              highlight={selected.has(row.cnpj)}
              onClick={(e) => onRowClick(e, row)}
              onPointerEnter={() => warmLead(row)}
              className={cn(
                "relative cursor-pointer p-4 hover:translate-y-0",
                selected.has(row.cnpj) && "bg-podium-yellow/[0.04]",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <GridCompanyLink
                    row={row}
                    searchId={searchId}
                    from={from}
                    onWarm={() => warmLead(row)}
                    className="min-w-0"
                  />
                  <PositionBadge
                    position={row.gridPosition}
                    score={row.gridScore}
                    hasAudit={qualified}
                  />
                </div>
                <RowSourceStatus row={row} qualifying={qualifying} />
                <p
                  className="mt-1 truncate text-xs text-podium-muted"
                  title={row.cnaeDescricao}
                >
                  {rowCompanyMeta(row)}
                </p>
                {row.email ? (
                  <p
                    className="mt-0.5 truncate text-[11px] text-podium-muted/80"
                    title={row.email}
                  >
                    {row.email}
                  </p>
                ) : null}
                <p className="mt-2 text-sm tabular-nums">
                  {formatPhone(ddd, tel) ?? <EmptyValue />}
                </p>
                {formatPhone(ddd, tel) ? (
                  <ContactSealBadge
                    compact
                    seal={row.seal}
                    label={sealLabel(row.seal, row.sharedCount)}
                    className="mt-0.5"
                  />
                ) : null}
                <p className="mt-1 break-words text-sm text-podium-gray">
                  Decisor: {row.decisorNome ?? "NÃO ENCONTRADO"}
                </p>
                <div className="mt-3">
                  <GridRowActions
                    row={row}
                    searchId={searchId}
                    callConnection={callConnection}
                    selected={selected.has(row.cnpj)}
                    qualifying={qualifying}
                    canRemove={Boolean(search?.saved)}
                    onToggle={() => toggleRow(row)}
                    onRemove={() => setAskRemoveCnpj(row.cnpj)}
                  />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
      )}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          className={cn(
            "mt-6 w-full rounded-md border border-white/15 py-2 text-xs font-medium text-podium-gray",
            selectedCount > 0 || unaudited > 0 ? "mb-24" : undefined,
          )}
        >
          Carregar mais
        </button>
      )}
        </>
      )}

      {unaudited > 0 ? <div className="h-24" aria-hidden /> : null}

      {unaudited > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-white/10 bg-podium-navy/95 px-4 py-2 backdrop-blur-xl lg:bottom-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-podium-gray">
              {selectedCount > 0 ? (
                <>
                  <span className="font-semibold text-podium-white">
                    {selectedCount}
                  </span>{" "}
                  selecionada{selectedCount === 1 ? "" : "s"} ·{" "}
                  {creditsEach(ENRICH_CREDIT_COST)} ·{" "}
                  <span className="font-semibold text-podium-yellow">
                    {selectedCost} créditos
                  </span>
                </>
              ) : (
                <>
                  Selecione quem qualificar
                  {" · "}
                  {creditsEach(ENRICH_CREDIT_COST)}
                </>
              )}
            </p>
            <div className="flex gap-2">
              {selectedCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected(new Set())}
                >
                  Limpar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={enrichMutation.isPending || selectedCount === 0}
                onClick={() => requestQualify({ cnpjs: [...selected] })}
              >
                {enrichMutation.isPending
                  ? "Qualificando…"
                  : selectedCount > 0
                    ? `Qualificar ${selectedCount}`
                    : "Qualificar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
