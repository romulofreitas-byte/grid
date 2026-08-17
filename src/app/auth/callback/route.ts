import { type NextRequest, NextResponse } from "next/server";
import { parseEmailOtpType } from "@/lib/auth/otp";
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

  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailOtpType(searchParams.get("type"));
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      console.error("auth callback verifyOtp:", error.message);
      return redirect("/entrar?error=session");
    }
    return redirect(next);
  }

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth callback exchangeCode:", error.message);
      return redirect("/entrar?error=session");
    }
    return redirect(next);
  }

  return redirect(next);
}
