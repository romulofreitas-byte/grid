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
import { AnimatePresence } from "framer-motion";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CrmAddDealDialog } from "@/components/crm/CrmAddDealDialog";
import { CrmCadencePanel } from "@/components/crm/CrmCadencePanel";
import { CrmDealCardView } from "@/components/crm/CrmDealCard";
import { CrmDealModal } from "@/components/crm/CrmDealModal";
import { CrmLane } from "@/components/crm/CrmLane";
import { CrmLanesSkeleton } from "@/components/crm/CrmBoardSkeleton";
import { CrmPipelineRail } from "@/components/crm/CrmPipelineRail";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { crmFetch } from "@/lib/crm/client";
import { closedDealCount, visibleKanbanDeals } from "@/lib/crm/events";
import {
  dedupeInflight,
  isBoardCacheFresh,
} from "@/lib/crm/pipeline-cache";
import type {
  CrmBoard as Board,
  CrmDealCard as Deal,
  CrmPipelineSummary,
} from "@/lib/crm/types";

type Columns = Record<string, string[]>;

const EMPTY_DEALS: Deal[] = [];

function cloneColumns(columns: Columns): Columns {
  return Object.fromEntries(
    Object.entries(columns).map(([stageId, ids]) => [stageId, [...ids]]),
  );
}

function group(board: Board | null, showClosedDeals = false): Columns {
  const columns: Columns = {};
  if (!board) return columns;
  for (const stage of board.stages) columns[stage.id] = [];
  const deals = visibleKanbanDeals(board.deals, showClosedDeals);
  for (const deal of [...deals].sort((a, b) => a.position - b.position)) {
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

function writeCrmUrl(pipelineId: string | null, dealId: string | null) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (pipelineId) params.set("pipeline", pipelineId);
  if (dealId) params.set("deal", dealId);
  const qs = params.toString();
  const next = qs ? `/crm?${qs}` : "/crm";
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.replaceState(window.history.state, "", next);
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
  const [columns, setColumns] = useState(() => group(initialBoard, false));
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
  const [showClosed, setShowClosed] = useState(false);
  const [loadingPipelineId, setLoadingPipelineId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    initialBoard?.pipeline.id ?? null,
  );
  const dndId = useId();
  const [dndReady, setDndReady] = useState(false);
  const cacheRef = useRef(
    new Map<string, Board>(
      initialBoard ? [[initialBoard.pipeline.id, initialBoard]] : [],
    ),
  );
  const fetchedAtRef = useRef(
    new Map<string, number>(
      initialBoard ? [[initialBoard.pipeline.id, Date.now()]] : [],
    ),
  );
  const inflightRef = useRef(new Map<string, Promise<Board>>());
  const requestedPipelineRef = useRef<string | null>(
    initialBoard?.pipeline.id ?? null,
  );

  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    for (const deal of board?.deals ?? []) map.set(deal.id, deal);
    return map;
  }, [board]);

  const kanbanDeals = useMemo(
    () => visibleKanbanDeals(board?.deals ?? [], showClosed),
    [board, showClosed],
  );
  const kanbanById = useMemo(() => {
    const map = new Map<string, Deal>();
    for (const deal of kanbanDeals) map.set(deal.id, deal);
    return map;
  }, [kanbanDeals]);
  const closedCount = closedDealCount(board?.deals ?? []);

  const openDeal = openDealId ? (dealsById.get(openDealId) ?? null) : null;

  useEffect(() => {
    setDndReady(true);
  }, []);

  useEffect(() => {
    if (board) cacheRef.current.set(board.pipeline.id, board);
  }, [board]);

  function writeUrl(pipelineId: string | null, dealId: string | null) {
    writeCrmUrl(pipelineId, dealId);
  }

  const openDealCard = useCallback(
    (dealId: string | null) => {
      setOpenDealId(dealId);
      writeCrmUrl(selectedPipelineId ?? board?.pipeline.id ?? null, dealId);
    },
    [selectedPipelineId, board?.pipeline.id],
  );

  useEffect(() => {
    if (activeId || syncLocked.current) return;
    setColumns(group(board, showClosed));
  }, [board, activeId, showClosed]);

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

  function fetchBoard(pipelineId: string): Promise<Board> {
    return dedupeInflight(inflightRef.current, pipelineId, async () => {
      const res = await crmFetch<{ board: Board }>(
        `/api/crm/pipelines/${pipelineId}`,
      );
      cacheRef.current.set(pipelineId, res.board);
      fetchedAtRef.current.set(pipelineId, Date.now());
      return res.board;
    });
  }

  async function prefetchPipeline(pipelineId: string) {
    if (
      cacheRef.current.has(pipelineId) &&
      isBoardCacheFresh(fetchedAtRef.current.get(pipelineId))
    ) {
      return;
    }
    try {
      await fetchBoard(pipelineId);
    } catch {
      /* prefetch is best-effort */
    }
  }

  async function loadPipeline(
    pipelineId: string,
    opts?: { force?: boolean },
  ): Promise<Board | null> {
    if (pipelineId === selectedPipelineId && board && !opts?.force) return board;
    setError(null);
    setSelectedPipelineId(pipelineId);
    requestedPipelineRef.current = pipelineId;
    setOpenDealId(null);
    writeUrl(pipelineId, null);
    const cached = cacheRef.current.get(pipelineId);
    const fresh =
      Boolean(cached) &&
      isBoardCacheFresh(fetchedAtRef.current.get(pipelineId)) &&
      !opts?.force;
    if (cached) {
      setBoard(cached);
      if (fresh) return cached;
    } else {
      setBoard(null);
      setLoadingPipelineId(pipelineId);
    }
    try {
      const next = await fetchBoard(pipelineId);
      if (requestedPipelineRef.current !== pipelineId) return null;
      setBoard(next);
      return next;
    } catch (err) {
      if (requestedPipelineRef.current !== pipelineId) return null;
      setError(err instanceof Error ? err.message : "Não foi possível abrir o nicho.");
      return null;
    } finally {
      if (requestedPipelineRef.current === pipelineId) {
        setLoadingPipelineId(null);
      }
    }
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
      setError(err instanceof Error ? err.message : "Não foi possível mover o card.");
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

  function moveDealToStage(dealId: string, stageId: string) {
    if (!board) return;
    const deal = board.deals.find((row) => row.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    const originColumns = cloneColumns(columnsRef.current);
    const nextColumns = cloneColumns(columnsRef.current);
    const fromItems = (nextColumns[deal.stage_id] ?? []).filter(
      (id) => id !== dealId,
    );
    const toItems = [...(nextColumns[stageId] ?? [])];
    if (!toItems.includes(dealId)) toItems.push(dealId);
    nextColumns[deal.stage_id] = fromItems;
    nextColumns[stageId] = toItems;
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
    dragOrigin.current = { columns: originColumns, board };
    syncLocked.current = true;
    setBoard((current) =>
      current ? applyLayout(current, nextColumns) : current,
    );
    void persistMove(dealId, stageId, Math.max(0, toItems.indexOf(dealId)));
  }

  const renameStage = useCallback(async (stageId: string, nome: string) => {
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
  }, []);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of board?.stages ?? []) {
      const deals = (columns[stage.id] ?? [])
        .map((id) => kanbanById.get(id) ?? dealsById.get(id))
        .filter((deal): deal is Deal => Boolean(deal));
      map.set(stage.id, deals);
    }
    return map;
  }, [board?.stages, columns, kanbanById, dealsById]);

  const activeDeal = activeId ? dealsById.get(activeId) : null;

  const lanes = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2">
      {loadingPipelineId && !board ? (
        <CrmLanesSkeleton />
      ) : (
        board?.stages.map((stage, index) => (
          <CrmLane
            key={stage.id}
            stage={stage}
            index={index}
            dnd={dndReady}
            deals={dealsByStage.get(stage.id) ?? EMPTY_DEALS}
            onOpenDeal={openDealCard}
            onRename={renameStage}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            {COPY.crmNav}
          </p>
          <h1 className="mt-1 text-lg font-semibold">
            {board?.pipeline.nome ??
              pipelines.find((row) => row.id === selectedPipelineId)?.nome ??
              COPY.crmTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-podium-gray">{COPY.crmHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={showClosed ? "accent" : "secondary"}
            onClick={() => setShowClosed((current) => !current)}
          >
            {showClosed ? COPY.crmHideClosed : COPY.crmShowClosed}
            {closedCount > 0 ? (
              <span className="ml-1.5 font-mono text-[10px] text-podium-muted">
                {closedCount}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setCadenceOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {COPY.crmAdjustCadence}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setAddOpen(true)}
            disabled={!board}
          >
            <Plus className="h-3.5 w-3.5" />
            {COPY.crmAddDeal}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mb-3 shrink-0 text-sm text-red-400">{error}</p>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <CrmPipelineRail
          pipelines={pipelines}
          activeId={selectedPipelineId}
          onSelect={(pipelineId) => void loadPipeline(pipelineId)}
          onPrefetch={(pipelineId) => void prefetchPipeline(pipelineId)}
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
            setSelectedPipelineId(res.board.pipeline.id);
            writeUrl(res.board.pipeline.id, null);
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
          onReorder={async (pipelineIds) => {
            const previous = pipelines;
            setError(null);
            setPipelines((current) => {
              const byId = new Map(current.map((row) => [row.id, row]));
              return pipelineIds.flatMap((id, position) => {
                const row = byId.get(id);
                return row ? [{ ...row, position }] : [];
              });
            });
            try {
              const res = await crmFetch<{ pipelines: CrmPipelineSummary[] }>(
                "/api/crm/pipelines/reorder",
                { method: "POST", body: JSON.stringify({ pipelineIds }) },
              );
              setPipelines(res.pipelines);
            } catch (err) {
              setPipelines(previous);
              setError(
                err instanceof Error
                  ? err.message
                  : "Não foi possível reordenar os nichos.",
              );
            }
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-1">
          {dndReady ? (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              {lanes}
              <DragOverlay dropAnimation={null}>
                {activeDeal ? (
                  <CrmDealCardView deal={activeDeal} overlay />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            lanes
          )}
        </div>
      </div>
      <AnimatePresence>
        {openDeal && board ? (
          <CrmDealModal
            key="crm-deal-modal"
            deal={openDeal}
            stages={board.stages}
            pipelineNome={board.pipeline.nome}
            onClose={() => openDealCard(null)}
            onChange={replaceDeal}
            onMoveStage={(stageId) => {
              moveDealToStage(openDeal.id, stageId);
            }}
            onDeleted={(dealId) => {
              const pipelineId = board.pipeline.id;
              setBoard((current) =>
                current
                  ? {
                      ...current,
                      deals: current.deals.filter((deal) => deal.id !== dealId),
                    }
                  : current,
              );
              if (pipelineId) bumpCount(pipelineId, -1);
              openDealCard(null);
            }}
          />
        ) : null}
      </AnimatePresence>
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
            await loadPipeline(board.pipeline.id, { force: true });
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
          pipelines={pipelines}
          currentPipelineId={board.pipeline.id}
          currentStages={board.stages}
          currentDeals={board.deals}
          onClose={() => setAddOpen(false)}
          onPipelineCreated={(pipeline, nextBoard) => {
            setPipelines((current) =>
              current.some((row) => row.id === pipeline.id)
                ? current
                : [...current, { ...pipeline, deal_count: 0 }],
            );
            cacheRef.current.set(nextBoard.pipeline.id, nextBoard);
            fetchedAtRef.current.set(nextBoard.pipeline.id, Date.now());
          }}
          onOpenExisting={(dealId, pipelineId) => {
            void (async () => {
              setAddOpen(false);
              const destId = pipelineId || board.pipeline.id;
              if (destId !== board.pipeline.id) {
                const next = await loadPipeline(destId);
                const opened = next?.deals.find((deal) => deal.id === dealId);
                if (opened && opened.outcome !== "open") setShowClosed(true);
                setOpenDealId(dealId);
                writeCrmUrl(destId, dealId);
                return;
              }
              const deal = dealsById.get(dealId);
              if (deal && deal.outcome !== "open") setShowClosed(true);
              openDealCard(dealId);
            })();
          }}
          onCreate={async (input) => {
            const destId = input.pipelineId;
            const sameBoard = destId === board.pipeline.id;
            const knownIds = new Set(board.deals.map((deal) => deal.id));
            const res = await crmFetch<{ deal: Deal }>(
              `/api/crm/pipelines/${destId}/deals`,
              {
                method: "POST",
                body: JSON.stringify({
                  company_name: input.company_name,
                  contact_name: input.contact_name,
                  secretaries: input.secretaries,
                  phones: input.phones,
                  cnpj: input.cnpj,
                  meta: input.meta,
                  stage_id: input.stage_id,
                }),
              },
            );
            setAddOpen(false);
            if (res.deal.outcome !== "open") setShowClosed(true);
            if (sameBoard) {
              replaceDeal(res.deal);
              if (!knownIds.has(res.deal.id)) bumpCount(destId, 1);
              openDealCard(res.deal.id);
              return;
            }
            bumpCount(destId, 1);
            await loadPipeline(destId, { force: true });
            setOpenDealId(res.deal.id);
            writeCrmUrl(destId, res.deal.id);
          }}
        />
      ) : null}
    </div>
  );
}
