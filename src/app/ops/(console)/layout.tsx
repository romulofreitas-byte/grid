import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OPS_COOKIE,
  opsCredentialsConfigured,
  verifyOpsToken,
} from "@/lib/ops/auth";
import { OpsHeader } from "@/app/ops/_components/OpsHeader";

export default async function OpsConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!opsCredentialsConfigured()) redirect("/ops/entrar");
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!token || !verifyOpsToken(token)) redirect("/ops/entrar");
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 md:px-6">
      <OpsHeader />
      <p className="sr-only">
        Área interna do Grid. <Link href="/ops">Dashboard</Link>
      </p>
      <div className="mt-6 flex-1 pb-16">{children}</div>
    </div>
  );
}
