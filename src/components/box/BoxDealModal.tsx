"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { crmFetch } from "@/lib/crm/client";
import type {
  CrmDealCard,
  CrmPipelineSummary,
  CrmStage,
} from "@/lib/crm/types";

const CrmDealModal = dynamic(
  () =>
    import("@/components/crm/CrmDealModal").then((mod) => mod.CrmDealModal),
  { ssr: false },
);

export function BoxDealModal({
  dealId,
  pipelineId,
  pipelineNome,
  onClose,
  onChanged,
}: {
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dirty = useRef(false);
  const [deal, setDeal] = useState<CrmDealCard | null>(null);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipelineSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDeal(null);
    void Promise.all([
      crmFetch<{ deal: CrmDealCard }>(`/api/crm/deals/${dealId}`),
      crmFetch<{ stages: CrmStage[] }>(
        `/api/crm/pipelines/${pipelineId}/stages`,
      ),
      crmFetch<{ pipelines: CrmPipelineSummary[] }>("/api/crm/pipelines"),
    ])
      .then(([dealRes, stagesRes, pipesRes]) => {
        if (cancelled) return;
        setDeal(dealRes.deal);
        setStages(stagesRes.stages);
        setPipelines(pipesRes.pipelines);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não abriu a ficha.");
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, pipelineId]);

  function close() {
    if (dirty.current) onChanged();
    onClose();
  }

  function mark(next: CrmDealCard) {
    dirty.current = true;
    setDeal(next);
  }

  async function moveStage(stageId: string) {
    if (!deal) return;
    try {
      const res = await crmFetch<{ deal: CrmDealCard }>(
        `/api/crm/deals/${deal.id}/move`,
        {
          method: "POST",
          body: JSON.stringify({ stageId, position: 0 }),
        },
      );
      mark(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não moveu a etapa.");
    }
  }

  if (error && !deal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-5">
        <button
          type="button"
          aria-label="Fechar"
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={close}
        />
        <div className="relative mx-4 rounded-lg border border-white/10 bg-podium-navy px-4 py-3 text-sm text-podium-white">
          {error}
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button
          type="button"
          aria-label="Fechar"
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={close}
        />
        <p className="relative text-sm text-podium-muted">Abrindo ficha…</p>
      </div>
    );
  }

  return (
    <CrmDealModal
      deal={deal}
      stages={stages}
      pipelineNome={pipelineNome}
      pipelines={pipelines}
      onClose={close}
      onChange={mark}
      onDeleted={() => {
        dirty.current = false;
        onChanged();
        onClose();
      }}
      onTransferred={() => {
        dirty.current = false;
        onChanged();
        onClose();
      }}
      onMoveStage={moveStage}
    />
  );
}
