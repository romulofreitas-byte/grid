import { TelefoniaPanel } from "@/components/integracoes/TelefoniaPanel";
import { parseTelefoniaTab } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function IntegracoesTelefoniaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; provider?: string }>;
}) {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const { tab, provider } = await searchParams;
  return (
    <TelefoniaPanel tab={parseTelefoniaTab(tab)} provider={provider} />
  );
}
