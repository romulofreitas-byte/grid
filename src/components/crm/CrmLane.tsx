"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { memo, useState } from "react";
import { CrmDealCard } from "@/components/crm/CrmDealCard";
import { sectorLabel } from "@/lib/crm/client";
import type { CrmDealCard as Deal, CrmStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export const CrmLane = memo(function CrmLane({
  stage,
  index,
  deals,
  onOpenDeal,
  onRename,
  dnd = true,
}: {
  stage: CrmStage;
  index: number;
  deals: Deal[];
  onOpenDeal: (dealId: string) => void;
  onRename: (stageId: string, nome: string) => void;
  dnd?: boolean;
}) {
  if (dnd) {
    return (
      <DroppableCrmLane
        stage={stage}
        index={index}
        deals={deals}
        onOpenDeal={onOpenDeal}
        onRename={onRename}
      />
    );
  }
  return (
    <CrmLaneShell
      stage={stage}
      index={index}
      deals={deals}
      onOpenDeal={onOpenDeal}
      onRename={onRename}
      dnd={false}
    />
  );
});

function DroppableCrmLane({
  stage,
  index,
  deals,
  onOpenDeal,
  onRename,
}: {
  stage: CrmStage;
  index: number;
  deals: Deal[];
  onOpenDeal: (dealId: string) => void;
  onRename: (stageId: string, nome: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${stage.id}`,
    data: { type: "lane", stageId: stage.id },
  });
  return (
    <CrmLaneShell
      stage={stage}
      index={index}
      deals={deals}
      onOpenDeal={onOpenDeal}
      onRename={onRename}
      dnd
      setNodeRef={setNodeRef}
      isOver={isOver}
    />
  );
}

function CrmLaneShell({
  stage,
  index,
  deals,
  onOpenDeal,
  onRename,
  dnd,
  setNodeRef,
  isOver = false,
}: {
  stage: CrmStage;
  index: number;
  deals: Deal[];
  onOpenDeal: (dealId: string) => void;
  onRename: (stageId: string, nome: string) => void;
  dnd: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  isOver?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.nome);

  function commit() {
    setEditing(false);
    const nome = draft.trim();
    if (nome && nome !== stage.nome) onRename(stage.id, nome);
    else setDraft(stage.nome);
  }

  const cards = deals.map((deal) => (
    <CrmDealCard key={deal.id} deal={deal} onOpen={onOpenDeal} dnd={dnd} />
  ));

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 w-[17.5rem] shrink-0 flex-col rounded-lg border border-white/[0.07] bg-podium-navy/40",
        isOver && "border-podium-yellow/35 bg-podium-yellow/[0.04]",
      )}
    >
      <header className="shrink-0 border-b border-white/[0.06] px-2.5 py-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-podium-yellow">
          {sectorLabel(index)}
        </p>
        {editing ? (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft(stage.nome);
                setEditing(false);
              }
            }}
            className="mt-1 w-full rounded-md border border-podium-yellow/30 bg-podium-panel px-2 py-1 text-xs font-medium text-podium-white outline-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 w-full text-left text-xs font-semibold leading-snug text-podium-white hover:text-podium-yellow"
          >
            {stage.nome}
          </button>
        )}
        <p className="mt-1 text-[11px] text-podium-muted">
          {deals.length} {deals.length === 1 ? "negócio" : "negócios"}
        </p>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {dnd ? (
          <SortableContext
            items={deals.map((deal) => deal.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards}
          </SortableContext>
        ) : (
          cards
        )}
        {deals.length === 0 ? (
          <p className="px-2 py-8 text-center text-[11px] text-podium-muted">
            Setor livre
          </p>
        ) : null}
      </div>
    </section>
  );
}
