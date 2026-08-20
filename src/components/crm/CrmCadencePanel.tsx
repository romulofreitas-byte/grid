"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { COPY } from "@/lib/copy";
import { CRM_FIELD, CRM_LABEL, sectorLabel } from "@/lib/crm/client";
import type { CrmDealCard, CrmStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export function CrmCadencePanel({
  stages,
  deals,
  onClose,
  onRename,
  onAdd,
  onDelete,
  onReorder,
}: {
  stages: CrmStage[];
  deals: CrmDealCard[];
  onClose: () => void;
  onRename: (stageId: string, nome: string) => void;
  onAdd: (nome: string) => void;
  onDelete: (stageId: string, moveToStageId?: string) => void;
  onReorder: (stageIds: string[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");

  function move(index: number, delta: number) {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    onReorder(next.map((stage) => stage.id));
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
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className={CRM_LABEL}>{COPY.crmCadenceTitle}</p>
            <h2 className="mt-1 text-lg font-extrabold">{COPY.crmAdjustCadence}</h2>
            <p className="mt-2 text-sm leading-relaxed text-podium-gray">
              {COPY.crmCadenceHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-podium-muted hover:bg-white/5 hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          {stages.map((stage, index) => {
            const count = deals.filter((deal) => deal.stage_id === stage.id)
              .length;
            const deleting = pendingDelete === stage.id;
            return (
              <div
                key={stage.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-podium-yellow">
                    {sectorLabel(index)}
                  </span>
                  <input
                    className={cn(CRM_FIELD, "py-1.5")}
                    defaultValue={stage.nome}
                    onBlur={(event) => {
                      const nome = event.target.value.trim();
                      if (nome && nome !== stage.nome) onRename(stage.id, nome);
                    }}
                  />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      className="text-podium-muted hover:text-podium-yellow"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      className="text-podium-muted hover:text-podium-yellow"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-podium-muted">
                  <span>
                    {count} {count === 1 ? "negócio" : "negócios"}
                  </span>
                  {stages.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDelete(stage.id);
                        setMoveTo(
                          stages.find((row) => row.id !== stage.id)?.id ?? "",
                        );
                      }}
                      className="hover:text-podium-alert"
                    >
                      {COPY.crmDeleteStage}
                    </button>
                  ) : null}
                </div>
                {deleting ? (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {count > 0 ? (
                      <label className="block">
                        <span className={CRM_LABEL}>{COPY.crmMoveDealsTo}</span>
                        <select
                          className={cn(CRM_FIELD, "mt-1.5")}
                          value={moveTo}
                          onChange={(event) => setMoveTo(event.target.value)}
                        >
                          {stages
                            .filter((row) => row.id !== stage.id)
                            .map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.nome}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onDelete(stage.id, count > 0 ? moveTo : undefined)
                        }
                        className="rounded-xl bg-podium-alert/20 px-3 py-1.5 text-xs font-semibold text-podium-alert"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="text-xs text-podium-muted"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <form
          className="flex gap-2 border-t border-white/10 px-5 py-4"
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
            className="inline-flex items-center gap-1 rounded-xl bg-podium-yellow px-3 text-sm font-bold text-podium-navy"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </div>
  );
}
