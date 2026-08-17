import { AppShell } from "@/components/AppShell";
import { ListsBoard } from "@/components/ListsBoard";
import { BACK } from "@/lib/back";
import { getRepo } from "@/lib/data";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ListasPage() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const profile = await repo.getProfile(session.id);
  const searches = await repo.listRecentSearches(profile.id);

  return (
    <AppShell title="Listas" back={BACK.box}>
      <ListsBoard initial={searches} />
    </AppShell>
  );
}
