import { type NextRequest, NextResponse } from "next/server";
import { parseCallbackParams } from "@/lib/auth/callback-params";
import { callbackErrorQuery, postVerifyPath } from "@/lib/auth/messages";
import { safeInternalPath } from "@/lib/auth/next-path";
import { createRouteClient, requestOrigin } from "@/lib/supabase/route-client";

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
    return redirect(postVerifyPath(params.type, next));
  }

  if (params.kind === "oauth") {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      console.error("auth callback exchangeCode:", error.message);
      return redirect(`/entrar?error=${callbackErrorQuery(error.message)}`);
    }
    return redirect(next);
  }

  return redirect("/entrar?error=session");
}
