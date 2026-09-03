import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OPS_COOKIE,
  opsCredentialsConfigured,
  verifyOpsToken,
} from "@/lib/ops/auth";
import { OpsLoginForm } from "@/app/ops/_components/OpsLoginForm";

export default async function OpsLoginPage() {
  if (opsCredentialsConfigured()) {
    const token = (await cookies()).get(OPS_COOKIE)?.value;
    if (token && verifyOpsToken(token)) redirect("/ops");
  }
  return <OpsLoginForm configured={opsCredentialsConfigured()} />;
}
