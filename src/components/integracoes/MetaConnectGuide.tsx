"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Columns3,
  FileText,
  Flag,
  LogIn,
  Unlock,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { startMetaOAuth } from "@/components/integracoes/MetaConnectCard";
import { Button, buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import type { CrmMetaConnection } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Scene = 1 | 2 | 3;
export type MetaOAuthFlash = "ok" | "denied" | "error";

const CHAIN = [
  {
    id: "page",
    title: COPY.integracoesGuideChainPage,
    hint: COPY.integracoesGuideChainPageHint,
    icon: Flag,
  },
  {
    id: "form",
    title: COPY.integracoesGuideChainForm,
    hint: COPY.integracoesGuideChainFormHint,
    icon: FileText,
  },
  {
    id: "board",
    title: COPY.integracoesGuideChainBoard,
    hint: COPY.integracoesGuideChainBoardHint,
    icon: Columns3,
  },
] as const;

const FACEBOOK = [
  {
    id: "login",
    title: COPY.integracoesGuideFacebookLogin,
    hint: COPY.integracoesGuideFacebookLoginHint,
    icon: LogIn,
  },
  {
    id: "pages",
    title: COPY.integracoesGuideFacebookPages,
    hint: COPY.integracoesGuideFacebookPagesHint,
    icon: Flag,
  },
  {
    id: "form",
    title: COPY.integracoesGuideFacebookForm,
    hint: COPY.integracoesGuideFacebookFormHint,
    icon: Unlock,
  },
] as const;

function StepStrip({
  scene,
  chainReady,
  pagesReady,
  onScene,
}: {
  scene: Scene;
  chainReady: boolean;
  pagesReady: boolean;
  onScene: (scene: Scene) => void;
}) {
  const items: Array<{ n: Scene; title: string; status: "todo" | "current" | "done" }> = [
    {
      n: 1,
      title: COPY.integracoesGuideStepChain,
      status: scene === 1 ? "current" : "done",
    },
    {
      n: 2,
      title: COPY.integracoesGuideStepFacebook,
      status: scene === 2 ? "current" : scene > 2 ? "done" : "todo",
    },
    {
      n: 3,
      title: COPY.integracoesGuideStepPages,
      status: scene === 3 ? "current" : "todo",
    },
  ];
  return (
    <ol className="flex gap-1">
      {items.map((item) => {
        const locked =
          (item.n === 2 && scene === 1 && !chainReady) ||
          (item.n === 3 && !pagesReady && scene !== 3);
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

function Piece({
  title,
  selected,
  seen,
  onClick,
  children,
}: {
  title: string;
  selected: boolean;
  seen: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition",
        selected
          ? "border-podium-yellow/55 bg-podium-yellow/12"
          : "border-white/12 bg-white/[0.04] hover:border-white/25",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md border",
          selected
            ? "border-podium-yellow/40 bg-podium-yellow/15 text-podium-yellow"
            : "border-white/10 text-podium-muted",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "text-xs font-semibold",
          selected ? "text-podium-white" : "text-podium-gray",
        )}
      >
        {title}
      </span>
      {seen && !selected ? (
        <Check className="h-3 w-3 text-podium-yellow" strokeWidth={3} aria-hidden />
      ) : (
        <span className="h-3" aria-hidden />
      )}
    </button>
  );
}

function ChainPieces({
  active,
  seen,
  onOpen,
}: {
  active: string;
  seen: Set<string>;
  onOpen: (id: (typeof CHAIN)[number]["id"]) => void;
}) {
  return (
    <div className="flex items-stretch gap-1 sm:gap-2">
      {CHAIN.map((item, index) => (
        <div key={item.id} className="contents">
          {index > 0 ? (
            <ChevronRight
              className="mt-8 hidden h-4 w-4 shrink-0 text-podium-muted sm:block"
              aria-hidden
            />
          ) : null}
          <Piece
            title={item.title}
            selected={active === item.id}
            seen={seen.has(item.id)}
            onClick={() => onOpen(item.id)}
          >
            <item.icon className="h-5 w-5" aria-hidden />
          </Piece>
        </div>
      ))}
    </div>
  );
}

function GuideSkeleton() {
  return (
    <GlassCard className="min-h-[22rem] space-y-4 p-4 hover:translate-y-0 sm:p-6">
      <div className="flex gap-1">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-white/5" />
      </div>
      <div className="flex gap-2 pt-6">
        <div className="h-28 flex-1 animate-pulse rounded-lg bg-white/5" />
        <div className="h-28 flex-1 animate-pulse rounded-lg bg-white/5" />
        <div className="h-28 flex-1 animate-pulse rounded-lg bg-white/5" />
      </div>
    </GlassCard>
  );
}

export function MetaConnectGuide({
  pages,
  configured,
  loading,
  pagesError,
  locked,
  proHref,
  flash,
  onRetryPages,
}: {
  pages: CrmMetaConnection[];
  configured: boolean;
  loading: boolean;
  pagesError: boolean;
  locked: boolean;
  proHref: string;
  flash: MetaOAuthFlash | null;
  onRetryPages: () => void;
}) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [chainActive, setChainActive] = useState<(typeof CHAIN)[number]["id"]>(
    CHAIN[0].id,
  );
  const [chainSeen, setChainSeen] = useState<Set<string>>(() => new Set([CHAIN[0].id]));
  const [fbActive, setFbActive] = useState<(typeof FACEBOOK)[number]["id"]>(
    FACEBOOK[0].id,
  );
  const [fbSeen, setFbSeen] = useState<Set<string>>(() => new Set([FACEBOOK[0].id]));

  useEffect(() => {
    if (loading && flash !== "ok") return;
    setScene((current) => {
      if (current !== null) return current;
      if (locked) return 1;
      if (pages.length > 0 || flash === "ok") return 3;
      if (flash === "denied" || flash === "error") return 2;
      return 1;
    });
  }, [flash, loading, locked, pages.length]);

  const chainHint = CHAIN.find((item) => item.id === chainActive)?.hint ?? "";
  const fbHint = FACEBOOK.find((item) => item.id === fbActive)?.hint ?? "";
  const chainReady = chainSeen.size === CHAIN.length;
  const fbReady = fbSeen.size === FACEBOOK.length;
  const pagesReady = pages.length > 0 || flash === "ok";

  function openChain(id: (typeof CHAIN)[number]["id"]) {
    setChainActive(id);
    setChainSeen((prev) => new Set(prev).add(id));
  }

  function openFacebook(id: (typeof FACEBOOK)[number]["id"]) {
    setFbActive(id);
    setFbSeen((prev) => new Set(prev).add(id));
  }

  function reconnect() {
    setFbSeen(new Set(FACEBOOK.map((item) => item.id)));
    setFbActive(FACEBOOK[0].id);
    setScene(2);
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
        <ChainPieces active={chainActive} seen={chainSeen} onOpen={openChain} />
        <p className="min-h-10 text-sm text-podium-gray">{chainHint}</p>
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
    flash === "ok"
      ? COPY.automacoesMetaConnected
      : flash === "denied"
        ? COPY.automacoesMetaDenied
        : flash === "error"
          ? COPY.automacoesMetaError
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
        chainReady={chainReady}
        pagesReady={pagesReady}
        onScene={(next) => {
          if (next === 3 && !pagesReady) return;
          if (next === 2 && !chainReady && scene === 1) return;
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
      {flashCopy && scene !== 1 ? (
        <p className="text-xs text-podium-muted">{flashCopy}</p>
      ) : null}

      {scene === 1 ? (
        <>
          <ChainPieces active={chainActive} seen={chainSeen} onOpen={openChain} />
          <p className="min-h-10 text-sm text-podium-gray">{chainHint}</p>
          {chainReady ? (
            <Button variant="primary" onClick={() => setScene(2)}>
              {COPY.integracoesGuideStart}
            </Button>
          ) : null}
        </>
      ) : null}

      {scene === 2 ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {FACEBOOK.map((item) => (
              <Piece
                key={item.id}
                title={item.title}
                selected={fbActive === item.id}
                seen={fbSeen.has(item.id)}
                onClick={() => openFacebook(item.id)}
              >
                <item.icon className="h-5 w-5" aria-hidden />
              </Piece>
            ))}
          </div>
          <p className="min-h-10 text-sm text-podium-gray">{fbHint}</p>
          {fbReady && configured ? (
            <Button variant="primary" onClick={startMetaOAuth}>
              {COPY.integracoesGuideContinueFacebook}
            </Button>
          ) : fbReady && !pagesError ? (
            <p className="text-xs text-podium-muted">
              {COPY.integracoesGuideNotConfigured}
            </p>
          ) : null}
        </>
      ) : null}

      {scene === 3 ? (
        <>
          {pages.length > 0 ? (
            <ul className="space-y-2">
              {pages.map((page) => (
                <li
                  key={page.id}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-podium-white"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-podium-yellow"
                    strokeWidth={3}
                    aria-hidden
                  />
                  {page.page_name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-podium-muted">{COPY.automacoesMetaPagesEmpty}</p>
          )}
          <p className="text-sm text-podium-gray">{COPY.integracoesGuideHandoff}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/automacoes/meta"
              className={buttonClassName({ variant: "primary" })}
            >
              {COPY.integracoesOpenAutomacoes}
            </Link>
            {configured ? (
              <Button variant="secondary" onClick={reconnect}>
                {COPY.automacoesConnectMetaAgain}
              </Button>
            ) : pagesError ? null : (
              <p className="self-center text-xs text-podium-muted">
                {COPY.integracoesGuideNotConfigured}
              </p>
            )}
          </div>
        </>
      ) : null}
    </GlassCard>
  );
}
