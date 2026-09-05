import { redirect } from "next/navigation";
import { conexoesLegacyRedirect } from "@/lib/back";

export default async function ConexoesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  redirect(conexoesLegacyRedirect(kind ?? null));
}
