"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { CRM_FIELD } from "@/lib/crm/client";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "grid-crm-nicho-rail";
const COLLAPSED = 36;
const MIN_OPEN = 148;
const MAX_OPEN = 240;
const SNAP_CLOSE = 92;

type RailPref = { open: boolean; width: number };

function readPref(): RailPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, width: 176 };
    const parsed = JSON.parse(raw) as Partial<RailPref>;
    return {
      open: Boolean(parsed.open),
      width: clampWidth(Number(parsed.width) || 176),
    };
  } catch {
    return { open: false, width: 176 };
  }
}

function clampWidth(value: number): number {
  return Math.min(MAX_OPEN, Math.max(MIN_OPEN, value));
}

export function CrmPipelineRail({
  pipelines,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  pipelines: CrmPipelineSummary[];
  activeId: string | null;
  onSelect: (pipelineId: string) => void;
  onCreate: (nome: string) => void;
  onRename: (pipelineId: string, nome: string) => void;
  onDelete: (pipelineId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(176);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startWidth: number; wasOpen: boolean } | null>(
    null,
  );

  useEffect(() => {
    const pref = readPref();
    setOpen(pref.open);
    setWidth(pref.width);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, width }));
  }, [open, width]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(event: PointerEvent) {
      const session = drag.current;
      if (!session) return;
      const next = session.startWidth + (event.clientX - session.startX);
      if (next < SNAP_CLOSE) {
        setOpen(false);
        return;
      }
      setOpen(true);
      setWidth(clampWidth(next));
    }
    function onUp() {
      drag.current = null;
      setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  function submitCreate() {
    const nome = draft.trim();
    if (!nome) {
      setCreating(false);
      return;
    }
    onCreate(nome);
    setDraft("");
    setCreating(false);
  }

  const active = pipelines.find((row) => row.id === activeId);

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden border-r border-white/10",
        !dragging && "transition-[width] duration-200 ease-out",
      )}
      style={{ width: open ? width : COLLAPSED }}
    >
      <button
        type="button"
        aria-label={open ? "Encolher nichos" : "Abrir nichos"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex shrink-0 items-center gap-1 px-1.5 py-2 text-podium-muted hover:text-podium-yellow",
          open ? "justify-between" : "h-full flex-col justify-start gap-3 pt-3",
        )}
      >
        {open ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              {COPY.crmNichoLabel}
            </span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-h-40 overflow-hidden text-[10px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]">
              {active?.nome ?? COPY.crmNichoLabel}
            </span>
          </>
        )}
      </button>

      {open ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-1">
            {pipelines.map((pipeline) => {
              const selected = pipeline.id === activeId;
              const confirming = pendingDeleteId === pipeline.id;
              return (
                <div key={pipeline.id} className="group relative">
                  {renamingId === pipeline.id ? (
                    <input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => {
                        const nome = renameDraft.trim();
                        if (nome && nome !== pipeline.nome) {
                          onRename(pipeline.id, nome);
                        }
                        setRenamingId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      className={cn(CRM_FIELD, "py-1 text-xs")}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(pipeline.id)}
                        onDoubleClick={() => {
                          setRenamingId(pipeline.id);
                          setRenameDraft(pipeline.nome);
                        }}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs leading-snug transition",
                          selected
                            ? "text-podium-white"
                            : "text-podium-muted hover:bg-white/[0.04] hover:text-podium-gray",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            selected ? "bg-podium-yellow" : "bg-white/20",
                          )}
                        />
                        <span className="min-w-0 truncate">{pipeline.nome}</span>
                      </button>
                      {selected && pipelines.length > 1 ? (
                        <button
                          type="button"
                          aria-label={COPY.crmDeletePipeline}
                          onClick={() => setPendingDeleteId(pipeline.id)}
                          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-podium-muted hover:bg-white/10 hover:text-podium-gray group-hover:inline-flex"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                  {confirming ? (
                    <div className="mx-1 mb-2 rounded-lg border border-white/10 bg-podium-panel p-2">
                      <p className="text-[11px] leading-snug text-podium-gray">
                        {COPY.crmDeletePipelineWarn}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="rounded-md px-2 py-1 text-[11px] text-podium-muted hover:text-podium-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(pipeline.id);
                            setPendingDeleteId(null);
                          }}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-podium-alert hover:bg-podium-alert/10"
                        >
                          {COPY.crmDeletePipelineConfirm}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {creating ? (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={submitCreate}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCreate();
                if (event.key === "Escape") setCreating(false);
              }}
              placeholder={COPY.crmNewPipeline}
              className={cn(CRM_FIELD, "mx-1 mb-2 py-1 text-xs")}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mb-2 inline-flex items-center gap-1 px-2 py-1.5 text-[11px] text-podium-muted hover:text-podium-yellow"
            >
              <Plus className="h-3 w-3" />
              {COPY.crmNewPipeline}
            </button>
          )}
        </>
      ) : null}

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Largura dos nichos"
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          drag.current = {
            startX: event.clientX,
            startWidth: open ? width : COLLAPSED,
            wasOpen: open,
          };
          setDragging(true);
        }}
      />
    </aside>
  );
}
