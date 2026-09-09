import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError } from "@/app/api/crm/_http";
import { publicRequestOrigin } from "@/lib/crm/inbound-token";
import {
  META_OAUTH_CALLBACK_ALIAS_PATH,
  metaConfigured,
  metaOAuthRedirectUri,
  metaOAuthUrl,
} from "@/lib/crm/meta-api";
import { signMetaOAuthState } from "@/lib/crm/meta-leads";

export async function GET(req: Request) {
  const gated = await guardAutomationsApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  if (!metaConfigured()) {
    return jsonError("Conexão com o Meta ainda não está configurada neste ambiente.", 503);
  }
  const origin = publicRequestOrigin(req);
  const url = metaOAuthUrl(
    metaOAuthRedirectUri(origin, META_OAUTH_CALLBACK_ALIAS_PATH),
    signMetaOAuthState(gated.userId),
  );
  return NextResponse.redirect(url);
}
