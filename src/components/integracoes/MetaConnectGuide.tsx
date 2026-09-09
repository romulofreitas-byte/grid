"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { startMetaOAuth } from "@/components/integracoes/MetaConnectCard";
import { Button, buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Scene = 1 | 2;
export type MetaOAuthFlash = "ok" | "denied" | "error" | "nopages";

function StepStrip({
  scene,
  pagesReady,
  onScene,
}: {
  scene: Scene;
  pagesReady: boolean;
  onScene: (scene: Scene) => void;
}) {
  const items: Array<{ n: Scene; title: string; status: "todo" | "current" | "done" }> = [
    {
      n: 1,
      title: COPY.integracoesGuideStepFacebook,
      status: scene === 1 ? "current" : "done",
    },
    {
      n: 2,
      title: COPY.integracoesGuideStepPages,
      status: scene === 2 ? "current" : "todo",
    },
  ];
  return (
    <ol className="flex gap-1">
      {items.map((item) => {
        const locked = item.n === 2 && !pagesReady && scene !== 2;
        return (
          <li key={item.n} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={locked}
              onClick={() => onScene(item.n)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition",
                item.status === "done" && "bg-podium-yellow/10 text-podium-white",
                item.status === "current" && "bg-white/[0.06] text-podium-white",
                item.status === "todo" && "text-podium-muted",
                locked && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  item.status === "done" && "bg-podium-yellow text-podium-navy",
                  item.status === "current" &&
                    "border border-podium-yellow/70 text-podium-yellow",
                  item.status === "todo" && "border border-white/15",
                )}
              >
                {item.status === "done" ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                ) : (
                  item.n
                )}
              </span>
              <span className="truncate">{item.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function GuideSkeleton() {
  return (
    <GlassCard className="min-h-[22rem] space-y-4 p-4 hover:translate-y-0 sm:p-6">
      <div className="flex gap-1">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-white/5" />
    </GlassCard>
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
    setSelected(
      new Set(selectableKey ? selectableKey.split("|") : []),
    );
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
      <GlassCard
        highlight
        className="min-h-[22rem] space-y-5 p-4 hover:translate-y-0 sm:p-6"
      >
        <p className="text-sm font-semibold text-podium-white">
          {COPY.integracoesFacebookTitle}
        </p>
        <p className="text-sm text-podium-gray">{COPY.integracoesFacebookBody}</p>
        <p className="text-sm text-podium-gray">{COPY.lockedAutomationsHighlight2}</p>
        <Link
          href={proHref}
          className={buttonClassName({ variant: "primary", className: "self-start" })}
        >
          {COPY.integracoesProCta}
        </Link>
      </GlassCard>
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

  return (
    <GlassCard
      highlight
      className="flex min-h-[22rem] flex-col gap-5 p-4 hover:translate-y-0 sm:p-6"
    >
      <p className="text-sm font-semibold text-podium-white">
        {COPY.integracoesFacebookTitle}
      </p>
      <StepStrip
        scene={scene}
        pagesReady={pagesReady}
        onScene={(next) => {
          if (next === 2 && !pagesReady) return;
          setScene(next);
        }}
      />
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
          {configured ? (
            <Button variant="primary" onClick={startMetaOAuth}>
              {COPY.integracoesGuideContinueFacebook}
            </Button>
          ) : pagesError ? null : (
            <p className="text-xs text-podium-muted">
              {COPY.integracoesGuideNotConfigured}
            </p>
          )}
        </>
      ) : null}

      {scene === 2 ? (
        <>
          {selectable.length > 0 ? (
            <>
              <p className="text-sm text-podium-gray">
                {COPY.integracoesGuidePickPages}
              </p>
              <ul className="space-y-2">
                {selectable.map((page) => (
                  <li key={page.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-podium-white">
                      <input
                        type="checkbox"
                        checked={selected.has(page.page_id)}
                        disabled={saving}
                        onChange={() => togglePage(page.page_id)}
                      />
                      {page.page_name}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-podium-muted">{COPY.automacoesMetaPagesEmpty}</p>
          )}
          {saveError ? (
            <p className="text-xs text-podium-muted">{saveError}</p>
          ) : null}
          {selectionDirty && selectable.length > 0 ? (
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => {
                void savePages();
              }}
            >
              {COPY.integracoesGuideSavePages}
            </Button>
          ) : null}
          {pages.length > 0 && !pending.length && !selectionDirty ? (
            <>
              <p className="text-sm text-podium-gray">{COPY.integracoesGuideHandoff}</p>
              <div className="flex flex-wrap gap-2">
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
                ) : pagesError ? null : (
                  <p className="self-center text-xs text-podium-muted">
                    {COPY.integracoesGuideNotConfigured}
                  </p>
                )}
              </div>
            </>
          ) : configured && (selectionDirty || pending.length > 0) ? (
            <Button variant="secondary" onClick={() => setScene(1)}>
              {COPY.automacoesConnectMetaAgain}
            </Button>
          ) : null}
        </>
      ) : null}
    </GlassCard>
  );
}
