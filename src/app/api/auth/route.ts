import { type NextRequest, NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { usesMockAuth } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/next-path";
import { createRouteClient } from "@/lib/supabase/route-client";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", siteUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

export async function POST(req: NextRequest) {
  const denied = await guardPublicApi(req, "auth");
  if (denied) return denied;
  const { supabase, applyCookies } = createRouteClient(req);
  const json = (body: unknown, status = 200) =>
    applyCookies(NextResponse.json(body, { status }));

  try {
    const body = (await req.json()) as {
      email?: string;
      provider?: string;
      next?: string;
    };
    const dest = safeInternalPath(body.next);
    const callbackNext = dest === "/box" ? "/entrar?go=1" : dest;
    if (usesMockAuth()) {
      return json({ mock: true, ok: true, next: dest });
    }
    if (!supabase) {
      return json({ error: "Auth não configurado" }, 500);
    }
    if (body.provider === "google") {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(callbackNext) },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ url: data.url });
    }
    if (!body.email) {
      return json({ error: "E-mail obrigatório" }, 400);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: body.email,
      options: { emailRedirectTo: callbackUrl(callbackNext) },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, magic: true });
  } catch {
    return json({ error: "Não foi possível entrar" }, 500);
  }
}
