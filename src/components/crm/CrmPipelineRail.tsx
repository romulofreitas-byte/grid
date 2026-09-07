"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useShellRailOpen } from "@/components/ShellRail";
import { Select } from "@/components/ui/Select";
import { COPY } from "@/lib/copy";
import { CRM_FIELD, crmFetch } from "@/lib/crm/client";
import type { PipelineRemovalPreview } from "@/lib/crm/pipeline-removal";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import {
  exclusiveCrmRails,
  readShellRailOpen,
} from "@/lib/shell-rail";
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
  onPrefetch,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: {
  pipelines: CrmPipelineSummary[];
  activeId: string | null;
  onSelect: (pipelineId: string) => void;
  onPrefetch?: (pipelineId: string) => void;
  onCreate: (nome: string) => void;
  onRename: (pipelineId: string, nome: string) => void;
  onDelete: (
    pipelineId: string,
    opts?: { transferToPipelineId?: string },
  ) => void | Promise<void>;
  onReorder: (pipelineIds: string[]) => void;
}) {
  const { open: shellOpen, setOpen: setShellOpen } = useShellRailOpen();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(176);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [removalPreview, setRemovalPreview] =
    useState<PipelineRemovalPreview | null>(null);
  const [transferToId, setTransferToId] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dndReady, setDndReady] = useState(false);
  const dndId = useId();
  const drag = useRef<{ startX: number; startWidth: number; wasOpen: boolean } | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const pref = readPref();
    const resolved = exclusiveCrmRails({
      shellOpen: readShellRailOpen(),
      nichoOpen: pref.open,
    });
    setOpen(resolved.nichoOpen);
    setWidth(pref.width);
    setDndReady(true);
    setShellOpen(resolved.shellOpen);
  }, [setShellOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, width }));
  }, [open, width]);

  useEffect(() => {
    if (!open || !shellOpen) return;
    setOpen(
      exclusiveCrmRails(
        { shellOpen, nichoOpen: open },
        { shellOpen: true },
      ).nichoOpen,
    );
  }, [open, shellOpen]);

  function applyNichoOpen(next: boolean) {
    const resolved = exclusiveCrmRails(
      { shellOpen, nichoOpen: open },
      { nichoOpen: next },
    );
    setOpen(resolved.nichoOpen);
    setShellOpen(resolved.shellOpen);
  }

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
      setShellOpen(false);
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
  }, [dragging, setShellOpen]);

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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pipelines.findIndex((row) => row.id === active.id);
    const newIndex = pipelines.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(pipelines, oldIndex, newIndex).map((row) => row.id));
  }

  async function confirmRemoval(pipelineId: string) {
    const transferNeeded =
      removalPreview != null && !removalPreview.canDeleteDirectly;
    if (transferNeeded && !transferToId) return;
    setDeleting(true);
    setRemovalError(null);
    try {
      await onDelete(
        pipelineId,
        transferNeeded ? { transferToPipelineId: transferToId } : undefined,
      );
      setPendingDeleteId(null);
      setRemovalPreview(null);
    } catch (err) {
      setRemovalError(
        err instanceof Error ? err.message : "Não deu para excluir o nicho.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const active = pipelines.find((row) => row.id === activeId);
  const sortableEnabled = pipelines.length > 1;
  const pipelineIds = pipelines.map((row) => row.id);

  const list = pipelines.map((pipeline) => (
    <SortablePipelineRow
      key={pipeline.id}
      pipeline={pipeline}
      selected={pipeline.id === activeId}
      confirming={pendingDeleteId === pipeline.id}
      removalPreview={
        pendingDeleteId === pipeline.id ? removalPreview : null
      }
      transferToId={transferToId}
      transferOptions={pipelines
        .filter((row) => row.id !== pipeline.id)
        .map((row) => ({ value: row.id, label: row.nome }))}
      removalError={pendingDeleteId === pipeline.id ? removalError : null}
      deleting={pendingDeleteId === pipeline.id && deleting}
      renaming={renamingId === pipeline.id}
      renameDraft={renameDraft}
      canDelete={pipeline.id === activeId && pipelines.length > 1}
      sortableDisabled={!sortableEnabled || renamingId === pipeline.id}
      onSelect={onSelect}
      onPrefetch={onPrefetch}
      onRenameDraftChange={setRenameDraft}
      onRenameCommit={() => {
        const nome = renameDraft.trim();
        if (nome && nome !== pipeline.nome) onRename(pipeline.id, nome);
        setRenamingId(null);
      }}
      onStartRename={() => {
        setRenamingId(pipeline.id);
        setRenameDraft(pipeline.nome);
      }}
      onAskDelete={() => {
        setPendingDeleteId(pipeline.id);
        setRemovalPreview(null);
        setRemovalError(null);
        setTransferToId(
          pipelines.find((row) => row.id !== pipeline.id)?.id ?? "",
        );
        void crmFetch<{ preview: PipelineRemovalPreview }>(
          `/api/crm/pipelines/${pipeline.id}/removal`,
        )
          .then((res) => setRemovalPreview(res.preview))
          .catch((err) =>
            setRemovalError(
              err instanceof Error ? err.message : "Não deu para conferir o nicho.",
            ),
          );
      }}
      onCancelDelete={() => {
        if (deleting) return;
        setPendingDeleteId(null);
        setRemovalPreview(null);
        setRemovalError(null);
      }}
      onTransferTo={setTransferToId}
      onConfirmDelete={() => {
        void confirmRemoval(pipeline.id);
      }}
    />
  ));

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 shrink-0 cursor-pointer flex-col overflow-hidden border-r border-white/10",
        !dragging && "transition-[width] duration-200 ease-out",
      )}
      style={{ width: open ? width : COLLAPSED }}
      onClick={(event) => {
        if (!open) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("button, input, [role='separator'], [data-nicho-row]")) return;
        applyNichoOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={open ? "Encolher nichos" : "Abrir nichos"}
        aria-expanded={open}
        onClick={() => applyNichoOpen(!open)}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1 px-1.5 py-2 text-podium-muted hover:text-podium-yellow",
          open ? "justify-between" : "h-full flex-col justify-start gap-3 pt-3",
        )}
      >
        {open ? (
          <>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em]">
              {COPY.crmNichoLabel}
            </span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-h-40 overflow-hidden text-[10px] font-medium uppercase tracking-[0.12em] [writing-mode:vertical-rl]">
              {active?.nome ?? COPY.crmNichoLabel}
            </span>
          </>
        )}
      </button>

      {open ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-1">
            {dndReady ? (
              <DndContext
                id={dndId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={pipelineIds} strategy={verticalListSortingStrategy}>
                  {list}
                </SortableContext>
              </DndContext>
            ) : null}
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
              className={cn(CRM_FIELD, "mx-1 mb-2 shrink-0 py-1 text-xs")}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mb-2 inline-flex shrink-0 items-center gap-1 px-2 py-1.5 text-[11px] text-podium-muted hover:text-podium-yellow"
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

function SortablePipelineRow({
  pipeline,
  selected,
  confirming,
  removalPreview,
  transferToId,
  transferOptions,
  removalError,
  deleting,
  renaming,
  renameDraft,
  canDelete,
  sortableDisabled,
  onSelect,
  onPrefetch,
  onRenameDraftChange,
  onRenameCommit,
  onStartRename,
  onAskDelete,
  onCancelDelete,
  onTransferTo,
  onConfirmDelete,
}: {
  pipeline: CrmPipelineSummary;
  selected: boolean;
  confirming: boolean;
  removalPreview: PipelineRemovalPreview | null;
  transferToId: string;
  transferOptions: { value: string; label: string }[];
  removalError: string | null;
  deleting: boolean;
  renaming: boolean;
  renameDraft: string;
  canDelete: boolean;
  sortableDisabled: boolean;
  onSelect: (pipelineId: string) => void;
  onPrefetch?: (pipelineId: string) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameCommit: () => void;
  onStartRename: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onTransferTo: (pipelineId: string) => void;
  onConfirmDelete: () => void;
}) {
  const sortable = useSortable({
    id: pipeline.id,
    disabled: sortableDisabled || renaming || confirming,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 1 : undefined,
    opacity: sortable.isDragging ? 0.7 : undefined,
  };
  const canDrag = !sortableDisabled && !renaming && !confirming;

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-nicho-row=""
      className="group relative cursor-auto"
    >
      {renaming ? (
        <input
          value={renameDraft}
          onChange={(event) => onRenameDraftChange(event.target.value)}
          onBlur={onRenameCommit}
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
            {...sortable.attributes}
            {...sortable.listeners}
            onClick={() => onSelect(pipeline.id)}
            onMouseEnter={() => onPrefetch?.(pipeline.id)}
            onFocus={() => onPrefetch?.(pipeline.id)}
            onDoubleClick={onStartRename}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-snug transition",
              selected
                ? "text-podium-white"
                : "text-podium-muted hover:bg-white/[0.04] hover:text-podium-gray",
              canDrag && (sortable.isDragging ? "cursor-grabbing" : "cursor-grab"),
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
          {canDelete ? (
            <button
              type="button"
              aria-label={COPY.crmDeletePipeline}
              onClick={onAskDelete}
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
            {removalPreview && !removalPreview.canDeleteDirectly
              ? COPY.crmDeletePipelineNeedTransfer
              : COPY.crmDeletePipelineWarn}
          </p>
          {removalPreview && removalPreview.matchingSavedListCount > 0 ? (
            <p className="mt-1.5 text-[11px] leading-snug text-podium-muted">
              {COPY.crmDeletePipelineLists.replace(
                "{n}",
                String(removalPreview.matchingSavedListCount),
              )}
            </p>
          ) : null}
          {removalPreview && !removalPreview.canDeleteDirectly ? (
            <div className="mt-2">
              <p className="mb-1 text-[10px] text-podium-muted">
                {COPY.crmDeletePipelineTransferTo}
              </p>
              <Select
                size="sm"
                value={transferToId}
                onChange={onTransferTo}
                options={transferOptions}
                aria-label={COPY.crmDeletePipelineTransferTo}
              />
            </div>
          ) : null}
          {removalError ? (
            <p className="mt-1.5 text-[11px] text-podium-alert">{removalError}</p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={onCancelDelete}
              className="rounded-md px-2 py-1 text-[11px] text-podium-muted hover:text-podium-white disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                deleting ||
                removalPreview == null ||
                Boolean(
                  removalPreview &&
                    !removalPreview.canDeleteDirectly &&
                    !transferToId,
                )
              }
              onClick={onConfirmDelete}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-podium-alert hover:bg-podium-alert/10 disabled:opacity-40"
            >
              {deleting
                ? "Excluindo…"
                : removalPreview && !removalPreview.canDeleteDirectly
                  ? COPY.crmDeletePipelineTransfer
                  : COPY.crmDeletePipelineConfirm}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
