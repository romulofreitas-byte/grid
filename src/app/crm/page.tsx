import { AppShell } from "@/components/AppShell";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
import { COPY } from "@/lib/copy";
import { getRepo } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function CrmPage() {
  try {
    return await CrmPageInner();
  } catch (err) {
    console.error("crm_page_error", err);
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return (
      <AppShell title={COPY.crmNav}>
        <GlassCard className="p-8">
          <p className="text-lg font-bold">Não deu para abrir a pista.</p>
          <p className="mt-3 text-sm text-podium-gray">{message}</p>
        </GlassCard>
      </AppShell>
    );
  }
}

async function CrmPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const pipelines = await repo.listCrmPipelines(session.id);
  const first = pipelines[0];
  const board = first
    ? await repo.getCrmBoard(session.id, first.id)
    : null;

  return (
    <AppShell title={COPY.crmNav} fill wide>
      <CrmBoard initialPipelines={pipelines} initialBoard={board} />
    </AppShell>
  );
}
