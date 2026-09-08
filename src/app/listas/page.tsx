import { GlassCard } from "@/components/GlassCard";
import { ListsBoard } from "@/components/ListsBoard";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { requireSession } from "@/lib/auth/session";
import { indexListPerformance } from "@/lib/listas/performance";
import { UNSAVED_LIST_CAP } from "@/lib/searches";
import { redirect, unstable_rethrow } from "next/navigation";

export default async function ListasPage() {
  try {
    return await ListasPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("listas_page_error", err);
    return (
      <GlassCard className="p-3">
        <p className="text-sm font-semibold">Não deu para carregar as listas.</p>
        <p className="mt-2 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}

async function ListasPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  void repo.pruneUnsavedSearches(session.id).catch((err) => {
    console.error("listas_prune_error", err);
  });
  const [saved, unsaved, pipelineNomes] = await Promise.all([
    repo.listSearches(session.id),
    repo.listRecentSearches(session.id, {
      saved: false,
      limit: UNSAVED_LIST_CAP,
    }),
    repo
      .listCrmPipelines(session.id)
      .then((pipelines) => pipelines.map((pipeline) => pipeline.nome))
      .catch((err) => {
        console.error("listas_pipelines_error", err);
        return [] as string[];
      }),
  ]);
  const savedIds = saved.map((row) => row.id);
  const performanceById = savedIds.length
    ? await repo
        .listSearchPerformance(session.id, savedIds)
        .then((rows) => indexListPerformance(rows, savedIds))
        .catch((err) => {
          console.error("listas_performance_error", err);
          return indexListPerformance([], savedIds);
        })
    : {};

  return (
    <ListsBoard
      initial={[...saved, ...unsaved]}
      pipelineNomes={pipelineNomes}
      performanceById={performanceById}
    />
  );
}
