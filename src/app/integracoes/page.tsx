import { IntegracoesHub } from "@/components/integracoes/IntegracoesHub";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function IntegracoesPage() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return <IntegracoesHub />;
}
