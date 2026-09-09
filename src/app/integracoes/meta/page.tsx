import { IntegracoesMetaConnect } from "@/components/integracoes/IntegracoesMetaConnect";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function IntegracoesMetaPage() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return <IntegracoesMetaConnect />;
}
