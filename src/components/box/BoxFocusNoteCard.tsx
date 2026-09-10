"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { crmFetch } from "@/lib/crm/client";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const DRAFT_MIN = 72;
const DRAFT_MAX = 128;

export function BoxFocusNoteCard({
  dealId,
  lastNote,
  locked,
  className,
}: {
  dealId: string;
  lastNote: string | null;
  locked: boolean;
  className?: string;
}) {
  const [note, setNote] = useState(lastNote ?? "");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNote(lastNote ?? "");
    setDraft("");
    setError(null);
    setExpanded(false);
  }, [dealId, lastNote]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    function measure() {
      if (!el || expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [note, expanded]);

  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, DRAFT_MIN), DRAFT_MAX)}px`;
  }, [draft]);

  async function save() {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      await crmFetch(`/api/crm/deals/${dealId}/events`, {
        method: "POST",
        body: JSON.stringify({ kind: "nota", body }),
      });
      setNote(body);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou a nota.");
    } finally {
      setSaving(false);
    }
  }

  const busy = locked || saving;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.03] p-3",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
        {COPY.boxNoteLast}
      </p>
      {note ? (
        <>
          <p
            ref={bodyRef}
            className={cn(
              "mt-1.5 text-pretty text-[13px] leading-snug text-podium-gray",
              !expanded && "line-clamp-3",
            )}
          >
            {note}
          </p>
          {overflows ? (
            <button
              type="button"
              className="mt-1 self-start text-[11px] text-podium-muted hover:text-podium-yellow hover:underline"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? COPY.boxNoteLess : COPY.boxNoteMore}
            </button>
          ) : null}
        </>
      ) : null}
      <textarea
        ref={draftRef}
        value={draft}
        disabled={busy}
        rows={3}
        placeholder={note ? COPY.boxNotePlaceholder : COPY.boxNoteEmpty}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
        className="mt-2 w-full resize-none overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[13px] leading-snug text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/30 disabled:opacity-40"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {error ? <p className="mr-auto text-[11px] text-podium-alert">{error}</p> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || !draft.trim()}
          onClick={() => void save()}
        >
          {saving ? "Salvando…" : COPY.crmSaveHistory}
        </Button>
      </div>
    </section>
  );
}
