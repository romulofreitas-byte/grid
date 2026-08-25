"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrmAddDealDialog } from "@/components/crm/CrmAddDealDialog";
import { CrmCadencePanel } from "@/components/crm/CrmCadencePanel";
import { CrmDealCardView } from "@/components/crm/CrmDealCard";
import { CrmDealDrawer } from "@/components/crm/CrmDealDrawer";
import { CrmLane } from "@/components/crm/CrmLane";
import { CrmPipelineRail } from "@/components/crm/CrmPipelineRail";
import { COPY } from "@/lib/copy";
import { crmFetch } from "@/lib/crm/client";
import type {
  CrmBoard as Board,
  CrmDealCard as Deal,
  CrmPipelineSummary,
} from "@/lib/crm/types";

type Columns = Record<string, string[]>;

function cloneColumns(columns: Columns): Columns {
  return Object.fromEntries(
    Object.entries(columns).map(([stageId, ids]) => [stageId, [...ids]]),
  );
}

function group(board: Board | null): Columns {
  const columns: Columns = {};
  if (!board) return columns;
  for (const stage of board.stages) columns[stage.id] = [];
  for (const deal of [...board.deals].sort((a, b) => a.position - b.position)) {
    if (!columns[deal.stage_id]) columns[deal.stage_id] = [];
    columns[deal.stage_id]!.push(deal.id);
  }
  return columns;
}

function applyLayout(board: Board, columns: Columns): Board {
  const loc = new Map<string, { stageId: string; position: number }>();
  for (const [stageId, ids] of Object.entries(columns)) {
    ids.forEach((id, position) => loc.set(id, { stageId, position }));
  }
  return {
    ...board,
    deals: board.deals.map((deal) => {
      const next = loc.get(deal.id);
      if (!next) return deal;
      if (deal.stage_id === next.stageId && deal.position === next.position) {
        return deal;
      }
      return { ...deal, stage_id: next.stageId, position: next.position };
    }),
  };
}

function findContainer(id: string, columns: Columns): string | undefined {
  if (id.startsWith("lane:")) return id.slice(5);
  return Object.keys(columns).find((stageId) => columns[stageId]?.includes(id));
}

export function CrmBoard({
  initialPipelines,
  initialBoard,
  initialDealId,
}: {
  initialPipelines: CrmPipelineSummary[];
  initialBoard: Board | null;
  initialDealId?: string;
}) {
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState(() => group(initialBoard));
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const dragOrigin = useRef<{ columns: Columns; board: Board | null } | null>(
    null,
  );
  const syncLocked = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(
    initialDealId ?? null,
  );
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    for (const deal of board?.deals ?? []) map.set(deal.id, deal);
    return map;
  }, [board]);

  const openDeal = openDealId ? (dealsById.get(openDealId) ?? null) : null;

  useEffect(() => {
    if (activeId || syncLocked.current) return;
    setColumns(group(board));
  }, [board, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function replaceDeal(next: Deal) {
    setBoard((current) => {
      if (!current) return current;
      const exists = current.deals.some((deal) => deal.id === next.id);
      return {
        ...current,
        deals: exists
          ? current.deals.map((deal) => (deal.id === next.id ? next : deal))
          : [...current.deals, next],
      };
    });
  }

  function bumpCount(pipelineId: string, delta: number) {
    setPipelines((current) =>
      current.map((pipeline) =>
        pipeline.id === pipelineId
          ? { ...pipeline, deal_count: Math.max(0, pipeline.deal_count + delta) }
          : pipeline,
      ),
    );
  }

  async function loadPipeline(pipelineId: string) {
    setError(null);
    const res = await crmFetch<{ board: Board }>(
      `/api/crm/pipelines/${pipelineId}`,
    );
    setBoard(res.board);
    setOpenDealId(null);
  }

  function revertDrag() {
    const origin = dragOrigin.current;
    if (!origin) return;
    columnsRef.current = origin.columns;
    setColumns(origin.columns);
    if (origin.board) setBoard(origin.board);
  }

  async function persistMove(dealId: string, stageId: string, position: number) {
    try {
      const res = await crmFetch<{ deal: Deal }>(
        `/api/crm/deals/${dealId}/move`,
        {
          method: "POST",
          body: JSON.stringify({ stageId, position }),
        },
      );
      replaceDeal(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não moveu o card.");
      revertDrag();
    } finally {
      syncLocked.current = false;
      dragOrigin.current = null;
    }
  }

  function onDragStart(event: DragStartEvent) {
    dragOrigin.current = {
      columns: cloneColumns(columnsRef.current),
      board,
    };
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeDealId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(activeDealId, columnsRef.current);
    const to = findContainer(overId, columnsRef.current);
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const fromItems = (current[from] ?? []).filter((id) => id !== activeDealId);
      const toItems = [...(current[to] ?? [])];
      const overIndex = overId.startsWith("lane:")
        ? toItems.length
        : toItems.indexOf(overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      toItems.splice(insertAt, 0, activeDealId);
      const next = { ...current, [from]: fromItems, [to]: toItems };
      columnsRef.current = next;
      return next;
    });
  }

  function onDragCancel() {
    revertDrag();
    syncLocked.current = false;
    dragOrigin.current = null;
    setActiveId(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const dealId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const cols = columnsRef.current;
    const from = findContainer(dealId, cols);
    const to = overId ? findContainer(overId, cols) : undefined;

    if (!overId || !from || !to) {
      onDragCancel();
      return;
    }

    let nextColumns = cols;
    if (from === to && !overId.startsWith("lane:")) {
      const list = cols[from] ?? [];
      const oldIndex = list.indexOf(dealId);
      const newIndex = list.indexOf(overId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        nextColumns = { ...cols, [from]: arrayMove(list, oldIndex, newIndex) };
        columnsRef.current = nextColumns;
        setColumns(nextColumns);
      }
    }

    const originStage = dragOrigin.current
      ? findContainer(dealId, dragOrigin.current.columns)
      : from;
    const originIndex = originStage
      ? (dragOrigin.current?.columns[originStage] ?? []).indexOf(dealId)
      : -1;
    const position = Math.max(0, (nextColumns[to] ?? []).indexOf(dealId));

    syncLocked.current = true;
    setBoard((current) =>
      current ? applyLayout(current, nextColumns) : current,
    );
    setActiveId(null);

    if (to === originStage && position === originIndex) {
      syncLocked.current = false;
      dragOrigin.current = null;
      return;
    }

    void persistMove(dealId, to, position);
  }

  const activeDeal = activeId ? dealsById.get(activeId) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-podium-yellow">
            {COPY.crmNav}
          </p>
          <h1 className="mt-1 text-xl font-extrabold md:text-2xl">
            {board?.pipeline.nome ?? COPY.crmTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-podium-gray">{COPY.crmHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCadenceOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {COPY.crmAdjustCadence}
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!board}
            className="inline-flex items-center gap-2 rounded-xl bg-podium-yellow px-3 py-2 text-sm font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {COPY.crmAddDeal}
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <div className="flex min-h-0 flex-1 gap-3">
        <CrmPipelineRail
          pipelines={pipelines}
          activeId={board?.pipeline.id ?? null}
          onSelect={(pipelineId) => void loadPipeline(pipelineId)}
          onCreate={async (nome) => {
            const res = await crmFetch<{
              pipeline: CrmPipelineSummary;
              board: Board;
            }>("/api/crm/pipelines", {
              method: "POST",
              body: JSON.stringify({ nome }),
            });
            setPipelines((current) => [
              ...current,
              { ...res.pipeline, deal_count: 0 },
            ]);
            setBoard(res.board);
          }}
          onRename={async (pipelineId, nome) => {
            const res = await crmFetch<{ pipeline: CrmPipelineSummary }>(
              `/api/crm/pipelines/${pipelineId}`,
              { method: "PATCH", body: JSON.stringify({ nome }) },
            );
            setPipelines((current) =>
              current.map((row) =>
                row.id === pipelineId ? { ...row, nome: res.pipeline.nome } : row,
              ),
            );
            setBoard((current) =>
              current && current.pipeline.id === pipelineId
                ? { ...current, pipeline: { ...current.pipeline, nome } }
                : current,
            );
          }}
          onDelete={async (pipelineId) => {
            const res = await crmFetch<{ pipelines: CrmPipelineSummary[] }>(
              `/api/crm/pipelines/${pipelineId}`,
              { method: "DELETE" },
            );
            setPipelines(res.pipelines);
            const next = res.pipelines[0];
            if (next) await loadPipeline(next.id);
          }}
        />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto pb-2">
            {board?.stages.map((stage, index) => (
              <CrmLane
                key={stage.id}
                stage={stage}
                index={index}
                deals={(columns[stage.id] ?? [])
                  .map((id) => dealsById.get(id))
                  .filter((deal): deal is Deal => Boolean(deal))}
                onOpenDeal={setOpenDealId}
                onRename={async (stageId, nome) => {
                  await crmFetch(`/api/crm/stages/${stageId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ nome }),
                  });
                  setBoard((current) =>
                    current
                      ? {
                          ...current,
                          stages: current.stages.map((row) =>
                            row.id === stageId ? { ...row, nome } : row,
                          ),
                        }
                      : current,
                  );
                }}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? <CrmDealCardView deal={activeDeal} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
      {openDeal ? (
        <CrmDealDrawer
          deal={openDeal}
          onClose={() => setOpenDealId(null)}
          onChange={replaceDeal}
          onDeleted={(dealId) => {
            const pipelineId = board?.pipeline.id;
            setBoard((current) =>
              current
                ? {
                    ...current,
                    deals: current.deals.filter((deal) => deal.id !== dealId),
                  }
                : current,
            );
            if (pipelineId) bumpCount(pipelineId, -1);
            setOpenDealId(null);
          }}
        />
      ) : null}
      {cadenceOpen && board ? (
        <CrmCadencePanel
          stages={board.stages}
          deals={board.deals}
          onClose={() => setCadenceOpen(false)}
          onRename={async (stageId, nome) => {
            await crmFetch(`/api/crm/stages/${stageId}`, {
              method: "PATCH",
              body: JSON.stringify({ nome }),
            });
            setBoard((current) =>
              current
                ? {
                    ...current,
                    stages: current.stages.map((row) =>
                      row.id === stageId ? { ...row, nome } : row,
                    ),
                  }
                : current,
            );
          }}
          onAdd={async (nome) => {
            const res = await crmFetch<{ stage: Board["stages"][number] }>(
              `/api/crm/pipelines/${board.pipeline.id}/stages`,
              { method: "POST", body: JSON.stringify({ nome }) },
            );
            setBoard((current) =>
              current
                ? { ...current, stages: [...current.stages, res.stage] }
                : current,
            );
          }}
          onDelete={async (stageId, moveToStageId) => {
            await crmFetch(`/api/crm/stages/${stageId}`, {
              method: "DELETE",
              body: JSON.stringify({ moveToStageId }),
            });
            await loadPipeline(board.pipeline.id);
            setCadenceOpen(true);
          }}
          onReorder={async (stageIds) => {
            const res = await crmFetch<{ board: Board }>(
              `/api/crm/pipelines/${board.pipeline.id}/stages/reorder`,
              { method: "POST", body: JSON.stringify({ stageIds }) },
            );
            setBoard(res.board);
          }}
        />
      ) : null}
      {addOpen && board ? (
        <CrmAddDealDialog
          onClose={() => setAddOpen(false)}
          onCreate={async (input) => {
            const res = await crmFetch<{ deal: Deal }>(
              `/api/crm/pipelines/${board.pipeline.id}/deals`,
              { method: "POST", body: JSON.stringify(input) },
            );
            replaceDeal(res.deal);
            bumpCount(board.pipeline.id, 1);
            setAddOpen(false);
            setOpenDealId(res.deal.id);
          }}
        />
      ) : null}
    </div>
  );
}
