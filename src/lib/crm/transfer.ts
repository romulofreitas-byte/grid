import {
  CRM_STAGE_KEYS,
  pickEntradaStage,
  type CrmStageKey,
} from "@/lib/crm/cadence";
import { uniquePhones } from "@/lib/crm/dial";
import type {
  CrmActivity,
  CrmDeal,
  CrmDealCard,
  CrmOutcome,
  CrmStage,
} from "@/lib/crm/types";

const OUTCOME_RANK: Record<CrmOutcome, number> = {
  lost: 0,
  open: 1,
  won: 2,
};

export type TransferStage = Pick<CrmStage, "id" | "nome" | "canonical_key">;

export type TransferDeal = Pick<
  CrmDeal,
  "id" | "pipeline_id" | "stage_id" | "outcome" | "notes" | "phones" | "amount_cents"
>;

export type CrmDealTransferResult = {
  deal: CrmDealCard;
  fromPipelineId: string;
  fromDealId: string;
  merged: boolean;
};

export function normalizeTransferStageNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

export function mapTransferStageId(
  source: TransferStage | undefined,
  destStages: TransferStage[],
): string | null {
  if (destStages.length === 0) return null;
  if (source?.canonical_key) {
    const byKey = destStages.find(
      (stage) => stage.canonical_key === source.canonical_key,
    );
    if (byKey) return byKey.id;
  }
  if (source?.nome) {
    const needle = normalizeTransferStageNome(source.nome);
    const byNome = destStages.find(
      (stage) => normalizeTransferStageNome(stage.nome) === needle,
    );
    if (byNome) return byNome.id;
  }
  return pickEntradaStage(destStages)?.id ?? destStages[0]?.id ?? null;
}

export function stageAdvancementRank(
  canonicalKey: CrmStageKey | string | null | undefined,
): number {
  if (!canonicalKey) return CRM_STAGE_KEYS.length;
  const index = CRM_STAGE_KEYS.indexOf(canonicalKey as CrmStageKey);
  return index < 0 ? CRM_STAGE_KEYS.length : index;
}

export function dealAdvancementRank(
  deal: Pick<TransferDeal, "outcome">,
  stage: TransferStage | undefined,
): number {
  return (
    OUTCOME_RANK[deal.outcome] * 100 + stageAdvancementRank(stage?.canonical_key)
  );
}

/** Destination wins ties so an already-worked card on the target nicho stays put. */
export function pickMergeSurvivor<T extends TransferDeal>(
  source: T,
  dest: T,
  sourceStage: TransferStage | undefined,
  destStage: TransferStage | undefined,
): T {
  return dealAdvancementRank(source, sourceStage) >
    dealAdvancementRank(dest, destStage)
    ? source
    : dest;
}

export function mergeDealNotes(survivor: string, other: string): string {
  const a = survivor.trim();
  const b = other.trim();
  if (!b) return a;
  if (!a) return b;
  if (a === b) return a;
  return `${a}\n\n${b}`;
}

export function mergeDealPhones(survivor: string[], other: string[]): string[] {
  return uniquePhones([...survivor, ...other]).slice(0, 8);
}

export function pickOpenActivityKeepId(
  activities: Array<Pick<CrmActivity, "id" | "due_at" | "created_at" | "status">>,
): string | null {
  const open = activities
    .filter((row) => row.status === "open")
    .sort(
      (a, b) =>
        a.due_at.localeCompare(b.due_at) || a.created_at.localeCompare(b.created_at),
    );
  return open[0]?.id ?? null;
}
