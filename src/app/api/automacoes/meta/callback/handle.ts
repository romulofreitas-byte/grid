import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { publicRequestOrigin } from "@/lib/crm/inbound-token";
import {
  isMetaOAuthCallbackPath,
  metaJoinUrl,
  metaOAuthRedirectUri,
  META_OAUTH_RETURN_PATH,
} from "@/lib/crm/meta-api";
import {
  encryptPageToken,
  exchangeMetaCode,
  listMetaPages,
  parseMetaOAuthState,
} from "@/lib/crm/meta-leads";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=denied`, req.url));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=error`, req.url));
  }
  const parsed = parseMetaOAuthState(state);
  if (!parsed) {
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=error`, req.url));
  }
  try {
    const origin = publicRequestOrigin(req);
    const callbackPath = url.pathname;
    const redirectUri = isMetaOAuthCallbackPath(callbackPath)
      ? metaJoinUrl(origin, callbackPath.replace(/\/+$/, "") || "/")
      : metaOAuthRedirectUri(origin);
    const userToken = await exchangeMetaCode(code, redirectUri);
    const pages = await listMetaPages(userToken);
    const repo = getRepo();
    let saved = 0;
    for (const page of pages) {
      const packed = encryptPageToken(page.access_token);
      const row = await repo.upsertCrmMetaConnection(parsed.userId, {
        pageId: page.id,
        pageName: page.name,
        credentialsCiphertext: packed.ciphertext,
        credentialsNonce: packed.nonce,
        status: "pending",
      });
      if (row) saved += 1;
      else console.error("meta_upsert_failed", page.id);
    }
    console.info("meta_oauth_pages", { listed: pages.length, saved });
    if (saved === 0) {
      const flash = pages.length > 0 ? "error" : "nopages";
      return NextResponse.redirect(
        new URL(`${META_OAUTH_RETURN_PATH}?meta=${flash}`, req.url),
      );
    }
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=ok`, req.url));
  } catch (err) {
    console.error("meta_oauth_callback_error", err);
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=error`, req.url));
  }
}
