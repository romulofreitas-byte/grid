import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { ListsBoard } from "@/components/ListsBoard";
import { BACK } from "@/lib/back";
import { getRepo } from "@/lib/data";
import { requireSession } from "@/lib/auth/session";
import { redirect, unstable_rethrow } from "next/navigation";

const LISTAS_LIMIT = 50;

export default async function ListasPage() {
  try {
    return await ListasPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("listas_page_error", err);
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return (
      <AppShell title="Listas">
        <GlassCard className="p-8">
          <p className="text-lg font-bold">Não deu para carregar as listas.</p>
          <p className="mt-3 text-sm text-podium-gray">{message}</p>
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
  const searches = await repo.listRecentSearches(profile.id, {
    limit: LISTAS_LIMIT,
  });
  const pipelines = await repo.listCrmPipelines(session.id);

  return (
    <AppShell title="Listas" back={BACK.box}>
      <ListsBoard
        initial={searches}
        pipelineNomes={pipelines.map((pipeline) => pipeline.nome)}
      />
    </AppShell>
  );
}
