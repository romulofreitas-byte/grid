import { type NextRequest, NextResponse } from "next/server";
import { parseCallbackParams } from "@/lib/auth/callback-params";
import { resolveAuthLanding } from "@/lib/auth/landing";
import { callbackErrorQuery, postVerifyPath } from "@/lib/auth/messages";
import { APP_HOME, SETUP_PATH, safeInternalPath } from "@/lib/auth/next-path";
import { createRouteClient, requestOrigin } from "@/lib/supabase/route-client";

function withLights(dest: string): string {
  const pathname = dest.split("?")[0];
  if (pathname === APP_HOME || pathname === "/box" || pathname === SETUP_PATH) {
    return `/entrar?go=1&next=${encodeURIComponent(dest)}`;
  }
  return dest;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = requestOrigin(request);
  const next = safeInternalPath(searchParams.get("next"), "/entrar?go=1");
  const { supabase, applyCookies } = createRouteClient(request);

  const redirect = (path: string) =>
    applyCookies(NextResponse.redirect(`${origin}${path}`));

  if (!supabase) return redirect("/entrar?error=config");

  const params = parseCallbackParams(searchParams);
  if (params.kind === "verify") {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type,
      token_hash: params.tokenHash,
    });
    if (error) {
      console.error("auth callback verifyOtp:", error.message);
      return redirect(`/entrar?error=${callbackErrorQuery(error.message)}`);
    }
    const verified = postVerifyPath(params.type, next);
    if (params.type === "recovery") return redirect(verified);
    const { data } = await supabase.auth.getUser();
    const landing = data.user
      ? await resolveAuthLanding(data.user.id, verified)
      : verified;
    return redirect(withLights(landing));
  }

  if (params.kind === "oauth") {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      console.error("auth callback exchangeCode:", error.message);
      return redirect(`/entrar?error=${callbackErrorQuery(error.message)}`);
    }
    const { data } = await supabase.auth.getUser();
    const landing = data.user
      ? await resolveAuthLanding(data.user.id, next)
      : next;
    return redirect(withLights(landing));
  }

  return redirect("/entrar?error=session");
}
