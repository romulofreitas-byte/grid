"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IntegrationFocusPanel } from "@/components/integracoes/IntegrationFocusPanel";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { startMetaOAuth } from "@/components/integracoes/MetaConnectCard";
import { Button, buttonClassName } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { COPY } from "@/lib/copy";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { getHubItem } from "@/lib/integrations/hub";

type Scene = 1 | 2;
export type MetaOAuthFlash = "ok" | "denied" | "error" | "nopages";

function GuideSkeleton() {
  return (
    <div className="min-h-[22rem] space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 sm:p-6">
      <div className="flex gap-1">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}

export function MetaConnectGuide({
  pages,
  pending,
  configured,
  loading,
  pagesError,
  locked,
  proHref,
  flash,
  onRetryPages,
}: {
  pages: CrmMetaConnection[];
  pending: CrmMetaConnection[];
  configured: boolean;
  loading: boolean;
  pagesError: boolean;
  locked: boolean;
  proHref: string;
  flash: MetaOAuthFlash | null;
  onRetryPages: () => void;
}) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const facebook = getHubItem("meta");

  const selectable = useMemo(() => {
    const byPageId = new Map<string, CrmMetaConnection>();
    for (const page of pages) byPageId.set(page.page_id, page);
    for (const page of pending) {
      if (!byPageId.has(page.page_id)) byPageId.set(page.page_id, page);
    }
    return [...byPageId.values()].sort((a, b) =>
      a.page_name.localeCompare(b.page_name, "pt-BR"),
    );
  }, [pages, pending]);

  const selectableKey = selectable.map((page) => page.page_id).join("|");

  useEffect(() => {
    if (loading) return;
    setScene((current) => {
      if (current !== null) return current;
      if (pending.length > 0 || pages.length > 0 || flash === "ok") return 2;
      return 1;
    });
  }, [flash, loading, pages.length, pending.length]);

  useEffect(() => {
    setSelected(new Set(selectableKey ? selectableKey.split("|") : []));
  }, [selectableKey]);

  const pagesReady = selectable.length > 0;
  const activeIds = useMemo(
    () => new Set(pages.map((page) => page.page_id)),
    [pages],
  );
  const selectionDirty =
    pending.length > 0 ||
    selected.size !== activeIds.size ||
    [...selected].some((id) => !activeIds.has(id));

  function togglePage(pageId: string) {
    setSaveError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function savePages() {
    if (selected.size === 0) {
      setSaveError(COPY.integracoesGuideSelectAtLeastOne);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/automacoes/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: [...selected] }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setSaveError(
          typeof json?.error === "string"
            ? json.error
            : COPY.integracoesGuideSaveError,
        );
        return;
      }
      onRetryPages();
    } catch {
      setSaveError(COPY.integracoesGuideSaveError);
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <IntegrationFocusPanel
        actions={
          <Link
            href={proHref}
            className={buttonClassName({ variant: "primary" })}
          >
            {COPY.integracoesProCta}
          </Link>
        }
      >
        <p className="text-sm text-podium-gray">{COPY.integracoesFacebookBody}</p>
        <p className="text-sm text-podium-gray">{COPY.lockedAutomationsHighlight2}</p>
      </IntegrationFocusPanel>
    );
  }

  if (scene === null) return <GuideSkeleton />;

  const flashCopy =
    flash === "denied"
      ? COPY.automacoesMetaDenied
      : flash === "error"
        ? COPY.automacoesMetaError
        : flash === "nopages"
          ? COPY.automacoesMetaNoPages
          : null;

  const facebookReady = pages.length > 0 && !pending.length && !selectionDirty;

  return (
    <IntegrationFocusPanel
      steps={[
        {
          id: "1",
          title: COPY.integracoesGuideStepFacebook,
          status: scene === 1 ? "current" : "done",
        },
        {
          id: "2",
          title: COPY.integracoesGuideStepPages,
          status: scene === 2 ? "current" : "todo",
          disabled: !pagesReady && scene !== 2,
        },
      ]}
      onStep={(id) => {
        const next = Number(id) as Scene;
        if (next === 2 && !pagesReady) return;
        setScene(next);
      }}
      actions={
        scene === 1 && configured ? (
          <Button variant="primary" onClick={startMetaOAuth} className="gap-2">
            {facebook ? <IntegrationLogo item={facebook} size="xs" active /> : null}
            {COPY.integracoesGuideContinueFacebook}
          </Button>
        ) : scene === 2 && selectionDirty && selectable.length > 0 ? (
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => {
              void savePages();
            }}
          >
            {COPY.integracoesGuideSavePages}
          </Button>
        ) : scene === 2 && facebookReady ? (
          <>
            <Link
              href="/automacoes/meta"
              className={buttonClassName({ variant: "primary" })}
            >
              {COPY.integracoesOpenAutomacoes}
            </Link>
            {configured ? (
              <Button variant="secondary" onClick={() => setScene(1)}>
                {COPY.automacoesConnectMetaAgain}
              </Button>
            ) : null}
          </>
        ) : configured && scene === 2 ? (
          <Button variant="secondary" onClick={() => setScene(1)}>
            {COPY.automacoesConnectMetaAgain}
          </Button>
        ) : null
      }
      help={
        <ol className="space-y-1.5">
          <li>1. Autorize o Facebook.</li>
          <li>2. Marque as Páginas que mandam o Formulário Instantâneo.</li>
          <li>3. Defina o destino no quadro.</li>
        </ol>
      }
    >
      {pagesError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-podium-muted">{COPY.integracoesGuidePagesError}</p>
          <Button size="sm" variant="ghost" onClick={onRetryPages}>
            {COPY.integracoesGuideRetry}
          </Button>
        </div>
      ) : null}
      {flashCopy ? (
        <p className="text-xs text-podium-muted">{flashCopy}</p>
      ) : null}

      {scene === 1 ? (
        <>
          <p className="text-sm text-podium-gray">{COPY.integracoesFacebookBody}</p>
          {!configured && !pagesError ? (
            <p className="text-xs text-podium-muted">
              {COPY.integracoesGuideNotConfigured}
            </p>
          ) : null}
        </>
      ) : null}

      {scene === 2 ? (
        <>
          {selectable.length > 0 ? (
            <>
              <p className="text-sm text-podium-gray">
                {COPY.integracoesGuidePickPages}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectable.map((page) => (
                  <ChoiceTile
                    key={page.id}
                    selected={selected.has(page.page_id)}
                    disabled={saving}
                    density="row"
                    onClick={() => togglePage(page.page_id)}
                  >
                    {page.page_name}
                  </ChoiceTile>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-podium-muted">{COPY.automacoesMetaPagesEmpty}</p>
          )}
          {saveError ? (
            <p className="text-xs text-podium-muted">{saveError}</p>
          ) : null}
          {facebookReady ? (
            <p className="text-sm text-podium-gray">{COPY.integracoesGuideHandoff}</p>
          ) : null}
        </>
      ) : null}
    </IntegrationFocusPanel>
  );
}
