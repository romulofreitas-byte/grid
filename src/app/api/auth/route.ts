import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { createClient } from "@/lib/supabase/server";
import { usesMockAuth } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/next-path";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", siteUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

export async function POST(req: Request) {
  const denied = await guardPublicApi(req, "auth");
  if (denied) return denied;
  try {
    const body = (await req.json()) as {
      email?: string;
      provider?: string;
      next?: string;
    };
    const dest = safeInternalPath(body.next);
    const callbackNext = dest === "/box" ? "/entrar?go=1" : dest;
    if (usesMockAuth()) {
      return NextResponse.json({ mock: true, ok: true, next: dest });
    }
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Auth não configurado" }, { status: 500 });
    }
    if (body.provider === "google") {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(callbackNext) },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ url: data.url });
    }
    if (!body.email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: body.email,
      options: { emailRedirectTo: callbackUrl(callbackNext) },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, magic: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível entrar" }, { status: 500 });
  }
}
