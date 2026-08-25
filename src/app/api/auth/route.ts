import { type NextRequest, NextResponse } from "next/server";
import { parseAuthAction } from "@/lib/auth/actions";
import { guardPublicApi } from "@/lib/auth/api-guard";
import {
  authCatchMessage,
  isDuplicateSignupUser,
  loginErrorMessage,
  oauthErrorMessage,
  passwordUpdateErrorMessage,
  signupErrorMessage,
} from "@/lib/auth/messages";
import { isValidEmail, validatePassword } from "@/lib/auth/password";
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

  let action: ReturnType<typeof parseAuthAction> = null;
  try {
    const body = (await req.json()) as {
      action?: string;
      email?: string;
      password?: string;
      provider?: string;
      next?: string;
    };
    action = parseAuthAction(body);
    if (!action) {
      return json({ error: "Ação inválida" }, 400);
    }
    const dest = safeInternalPath(body.next);
    const callbackNext = dest === "/box" ? "/entrar?go=1" : dest;

    if (action === "logout") {
      if (usesMockAuth()) {
        return json({ mock: true, ok: true });
      }
      if (supabase) {
        await supabase.auth.signOut();
      }
      return json({ ok: true });
    }

    if (usesMockAuth()) {
      if (action === "recover") {
        return json({ mock: true, ok: true, recover: true });
      }
      if (action === "resend") {
        return json({ mock: true, ok: true, confirm: true });
      }
      return json({ mock: true, ok: true, next: dest });
    }
    if (!supabase) {
      return json({ error: "Auth não configurado" }, 500);
    }

    if (action === "google") {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(callbackNext) },
      });
      if (error) return json({ error: oauthErrorMessage(error.message) }, 400);
      return json({ url: data.url });
    }

    if (action === "password") {
      const passwordError = validatePassword(body.password);
      if (passwordError) return json({ error: passwordError }, 400);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return json({ error: "Não autenticado" }, 401);
      }
      const { error } = await supabase.auth.updateUser({
        password: body.password,
      });
      if (error) return json({ error: passwordUpdateErrorMessage(error.message) }, 400);
      return json({ ok: true, next: dest });
    }

    const email = body.email?.trim() ?? "";
    if (!isValidEmail(email)) {
      return json({ error: "E-mail obrigatório" }, 400);
    }

    if (action === "recover") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl("/entrar?definir=1"),
      });
      if (error) console.error("auth recover:", error.message);
      return json({ ok: true, recover: true });
    }

    if (action === "resend") {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: callbackUrl(callbackNext) },
      });
      if (error) {
        console.error("auth resend:", error.message);
        return json({ error: authCatchMessage("resend") }, 400);
      }
      return json({ ok: true, confirm: true });
    }

    const passwordError = validatePassword(body.password);
    if (passwordError) return json({ error: passwordError }, 400);
    const password = body.password as string;

    if (action === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl(callbackNext) },
      });
      if (error) {
        return json({ error: signupErrorMessage(error.message) }, 400);
      }
      if (data.session) {
        return json({ ok: true, next: dest });
      }
      if (isDuplicateSignupUser(data.user)) {
        return json(
          { error: signupErrorMessage("already registered"), existing: true },
          400,
        );
      }
      return json({ ok: true, confirm: true });
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return json({ error: loginErrorMessage(error.message) }, 400);
    }
    return json({ ok: true, next: dest });
  } catch {
    return json({ error: authCatchMessage(action) }, 500);
  }
}
