import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import {
  credentialsMatch,
  OPS_COOKIE,
  opsCookieOptions,
  opsCredentialsConfigured,
  signOpsToken,
} from "@/lib/ops/auth";

export async function POST(req: Request) {
  const denied = await guardPublicApi(req, "auth");
  if (denied) return denied;
  if (!opsCredentialsConfigured()) {
    return NextResponse.json({ error: "Ops desligado" }, { status: 503 });
  }
  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!credentialsMatch(email, password)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, signOpsToken(), opsCookieOptions());
  return res;
}
