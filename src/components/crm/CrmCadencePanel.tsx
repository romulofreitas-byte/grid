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
import { Lock, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { COPY } from "@/lib/copy";
import { isLockedStageKey } from "@/lib/crm/cadence";
import { CRM_FIELD, CRM_LABEL, sectorLabel } from "@/lib/crm/client";
import type { CrmDealCard, CrmStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";

export function CrmCadencePanel({
  pipelineNome,
  stages,
  deals,
  otherNichoCount,
  onClose,
  onRename,
  onAdd,
  onDelete,
  onReorder,
  onApplyToOthers,
}: {
  pipelineNome: string;
  stages: CrmStage[];
  deals: CrmDealCard[];
  otherNichoCount: number;
  onClose: () => void;
  onRename: (stageId: string, nome: string) => void;
  onAdd: (nome: string) => void;
  onDelete: (stageId: string, moveToStageId?: string) => void;
  onReorder: (stageIds: string[]) => void;
  onApplyToOthers: () => Promise<void>;
}) {
  const dndId = useId();
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const countByStage = new Map<string, number>();
  for (const deal of deals) {
    countByStage.set(deal.stage_id, (countByStage.get(deal.stage_id) ?? 0) + 1);
  }

  const stageIds = stages.map((stage) => stage.id);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((row) => row.id === active.id);
    const newIndex = stages.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(stages, oldIndex, newIndex).map((row) => row.id));
  }

  async function applyToOthers() {
    setApplying(true);
    setApplyError(null);
    try {
      await onApplyToOthers();
      setConfirmApply(false);
    } catch (err) {
      setApplyError(
        err instanceof Error ? err.message : "Não foi possível aplicar.",
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-podium-navy shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-3 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{COPY.crmAdjustCadence}</h2>
            <p className="mt-0.5 truncate text-xs text-podium-muted">
              {pipelineNome}
            </p>
            {otherNichoCount > 0 ? (
              confirmApply ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] leading-snug text-podium-muted">
                    {COPY.crmCadenceApplyHint
                      .replace("{n}", String(otherNichoCount))
                      .replace(
                        "{nichoWord}",
                        otherNichoCount === 1 ? "nicho" : "nichos",
                      )}
                  </p>
                  {applyError ? (
                    <p className="text-[11px] text-podium-alert">{applyError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => void applyToOthers()}
                      className="rounded-md bg-podium-yellow px-2.5 py-1 text-[11px] font-medium text-podium-navy disabled:opacity-60"
                    >
                      {COPY.crmCadenceApplyConfirm}
                    </button>
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => {
                        setConfirmApply(false);
                        setApplyError(null);
                      }}
                      className="text-[11px] text-podium-muted"
                    >
                      {COPY.confirmCancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmApply(true);
                    setApplyError(null);
                  }}
                  className="mt-1 text-[11px] text-podium-muted hover:text-podium-white"
                >
                  {COPY.crmCadenceApplyOthers}
                </button>
              )
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-md p-1.5 text-podium-muted hover:bg-white/5 hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
              <ul className="flex min-h-full flex-1 flex-col py-1">
                {stages.map((stage, index) => (
                  <SortableCadenceRow
                    key={stage.id}
                    stage={stage}
                    index={index}
                    count={countByStage.get(stage.id) ?? 0}
                    deleting={pendingDelete === stage.id}
                    stages={stages}
                    moveTo={moveTo}
                    sortableDisabled={pendingDelete === stage.id}
                    onRename={onRename}
                    onDelete={onDelete}
                    onAskDelete={() => {
                      setPendingDelete(stage.id);
                      setMoveTo(
                        stages.find((row) => row.id !== stage.id)?.id ?? "",
                      );
                    }}
                    onCancelDelete={() => setPendingDelete(null)}
                    onMoveTo={setMoveTo}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        <form
          className="flex shrink-0 gap-2 border-t border-white/10 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            const nome = newName.trim();
            if (!nome) return;
            onAdd(nome);
            setNewName("");
          }}
        >
          <input
            className={CRM_FIELD}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={COPY.crmAddStage}
          />
          <button
            type="submit"
            aria-label={COPY.crmAddStage}
            className="inline-flex items-center gap-1 rounded-md bg-podium-yellow px-2.5 text-xs font-medium text-podium-navy"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </div>
  );
}

function SortableCadenceRow({
  stage,
  index,
  count,
  deleting,
  stages,
  moveTo,
  sortableDisabled,
  onRename,
  onDelete,
  onAskDelete,
  onCancelDelete,
  onMoveTo,
}: {
  stage: CrmStage;
  index: number;
  count: number;
  deleting: boolean;
  stages: CrmStage[];
  moveTo: string;
  sortableDisabled: boolean;
  onRename: (stageId: string, nome: string) => void;
  onDelete: (stageId: string, moveToStageId?: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onMoveTo: (stageId: string) => void;
}) {
  const locked = isLockedStageKey(stage.canonical_key);
  const canDelete = !locked && stages.length > 1;
  const sortable = useSortable({
    id: stage.id,
    disabled: sortableDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 1 : undefined,
    opacity: sortable.isDragging ? 0.7 : undefined,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="group flex min-h-12 flex-1 flex-col border-b border-white/[0.06] last:border-b-0"
    >
      <div className="flex min-h-12 flex-1 items-center gap-1.5">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reordenar ${stage.nome}`}
          disabled={sortableDisabled}
          className={cn(
            "flex w-5 shrink-0 touch-none items-center justify-center self-stretch font-mono text-[10px] text-podium-yellow",
            sortableDisabled
              ? "cursor-default"
              : sortable.isDragging
                ? "cursor-grabbing"
                : "cursor-grab",
          )}
        >
          {sectorLabel(index)}
        </button>
        <span className="inline-flex w-3 shrink-0 items-center justify-center text-podium-muted">
          {locked ? (
            <span title={COPY.crmFirstMileLocked}>
              <Lock className="h-3 w-3" aria-label={COPY.crmFirstMileLocked} />
            </span>
          ) : null}
        </span>
        <input
          className={cn(CRM_FIELD, "min-w-0 flex-1 py-1")}
          defaultValue={stage.nome}
          onBlur={(event) => {
            const nome = event.target.value.trim();
            if (nome && nome !== stage.nome) onRename(stage.id, nome);
          }}
        />
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
          {canDelete ? (
            <button
              type="button"
              aria-label={COPY.crmDeleteStage}
              onClick={onAskDelete}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10 hover:text-podium-alert",
                deleting
                  ? "text-podium-alert"
                  : "text-podium-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
              )}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      </div>
      {deleting ? (
        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
          {count > 0 ? (
            <label className="block">
              <span className={CRM_LABEL}>{COPY.crmMoveDealsTo}</span>
              <Select
                size="sm"
                className="mt-1.5 w-full"
                value={moveTo}
                onChange={onMoveTo}
                options={stages
                  .filter((row) => row.id !== stage.id)
                  .map((row) => ({
                    value: row.id,
                    label: row.nome,
                  }))}
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDelete(stage.id, count > 0 ? moveTo : undefined)}
              className="rounded-md bg-podium-alert/20 px-2.5 py-1 text-[11px] font-medium text-podium-alert"
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-xs text-podium-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
