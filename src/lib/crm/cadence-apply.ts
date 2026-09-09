import { normalizeTransferStageNome } from "@/lib/crm/transfer";

export type CadenceApplyStage = {
  id: string;
  nome: string;
  canonical_key: string | null;
};

export type CadenceApplyPlan = {
  renames: Array<{ id: string; nome: string }>;
  creates: string[];
};

export function matchDestStage(
  source: Pick<CadenceApplyStage, "nome" | "canonical_key">,
  dest: CadenceApplyStage[],
  used: Set<string>,
): CadenceApplyStage | undefined {
  if (source.canonical_key) {
    return dest.find(
      (row) => row.canonical_key === source.canonical_key && !used.has(row.id),
    );
  }
  const needle = normalizeTransferStageNome(source.nome);
  if (!needle) return undefined;
  return dest.find(
    (row) =>
      !row.canonical_key &&
      !used.has(row.id) &&
      normalizeTransferStageNome(row.nome) === needle,
  );
}

export function planApplyCadence(
  source: Array<Pick<CadenceApplyStage, "nome" | "canonical_key">>,
  dest: CadenceApplyStage[],
): CadenceApplyPlan {
  const renames: CadenceApplyPlan["renames"] = [];
  const creates: string[] = [];
  const used = new Set<string>();

  for (const src of source) {
    const nome = src.nome.trim();
    if (!nome) continue;
    const match = matchDestStage({ ...src, nome }, dest, used);
    if (match) {
      used.add(match.id);
      if (match.nome !== nome) {
        renames.push({ id: match.id, nome });
      }
      continue;
    }
    if (src.canonical_key) continue;
    const needle = normalizeTransferStageNome(nome);
    const destHasName = dest.some(
      (row) =>
        !row.canonical_key &&
        normalizeTransferStageNome(row.nome) === needle,
    );
    if (!destHasName) creates.push(nome);
  }

  return { renames, creates };
}

export function orderAppliedCadence(
  source: Array<Pick<CadenceApplyStage, "nome" | "canonical_key">>,
  dest: CadenceApplyStage[],
): string[] {
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const src of source) {
    const match = matchDestStage(src, dest, used);
    if (!match) continue;
    ordered.push(match.id);
    used.add(match.id);
  }
  for (const row of dest) {
    if (!used.has(row.id)) ordered.push(row.id);
  }
  return ordered;
}

export type CadenceApplyOps = {
  listPipelines: () => Promise<Array<{ id: string }>>;
  listStages: (pipelineId: string) => Promise<CadenceApplyStage[] | null>;
  updateStageNome: (stageId: string, nome: string) => Promise<unknown>;
  createStage: (pipelineId: string, nome: string) => Promise<unknown>;
  reorderStages: (pipelineId: string, stageIds: string[]) => Promise<boolean>;
};

export async function applyCadenceToOtherPipelines(
  ops: CadenceApplyOps,
  sourcePipelineId: string,
): Promise<{ applied: number } | null> {
  const source = await ops.listStages(sourcePipelineId);
  if (!source) return null;
  const pipelines = await ops.listPipelines();
  let applied = 0;
  for (const pipeline of pipelines) {
    if (pipeline.id === sourcePipelineId) continue;
    const dest = await ops.listStages(pipeline.id);
    if (!dest) continue;
    const plan = planApplyCadence(source, dest);
    for (const rename of plan.renames) {
      await ops.updateStageNome(rename.id, rename.nome);
    }
    for (const nome of plan.creates) {
      await ops.createStage(pipeline.id, nome);
    }
    const after =
      plan.renames.length > 0 || plan.creates.length > 0
        ? await ops.listStages(pipeline.id)
        : dest;
    if (!after) continue;
    const ordered = orderAppliedCadence(source, after);
    if (await ops.reorderStages(pipeline.id, ordered)) applied += 1;
  }
  return { applied };
}
