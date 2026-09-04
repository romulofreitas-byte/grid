import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { ListsBoard } from "@/components/ListsBoard";
import { BACK } from "@/lib/back";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { requireSession } from "@/lib/auth/session";
import { UNSAVED_LIST_CAP } from "@/lib/searches";
import { redirect, unstable_rethrow } from "next/navigation";

export default async function ListasPage() {
  try {
    return await ListasPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("listas_page_error", err);
    return (
      <AppShell title="Listas">
        <GlassCard className="p-8">
          <p className="text-lg font-bold">Não deu para carregar as listas.</p>
          <p className="mt-3 text-sm text-podium-gray">
            {userFacingDbBusyMessage(err)}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}

async function ListasPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const profile = await repo.getProfile(session.id);
  await repo.pruneUnsavedSearches(profile.id);
  const [saved, unsaved, pipelineNomes] = await Promise.all([
    repo.listSearches(profile.id),
    repo.listRecentSearches(profile.id, {
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

  return (
    <AppShell title="Listas" back={BACK.painel}>
      <ListsBoard
        initial={[...saved, ...unsaved]}
        pipelineNomes={pipelineNomes}
      />
    </AppShell>
  );
}
