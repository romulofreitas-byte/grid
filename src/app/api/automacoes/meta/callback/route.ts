import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { publicRequestOrigin } from "@/lib/crm/inbound-token";
import { metaOAuthRedirectUri, META_OAUTH_RETURN_PATH } from "@/lib/crm/meta-api";
import {
  encryptPageToken,
  exchangeMetaCode,
  listMetaPages,
  parseMetaOAuthState,
  subscribePageToLeadgen,
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
    const userToken = await exchangeMetaCode(code, metaOAuthRedirectUri(origin));
    const pages = await listMetaPages(userToken);
    const repo = getRepo();
    for (const page of pages) {
      try {
        await subscribePageToLeadgen(page.access_token, page.id);
      } catch (err) {
        console.error("meta_subscribe_failed", page.id, err);
      }
      const packed = encryptPageToken(page.access_token);
      await repo.upsertCrmMetaConnection(parsed.userId, {
        pageId: page.id,
        pageName: page.name,
        credentialsCiphertext: packed.ciphertext,
        credentialsNonce: packed.nonce,
      });
    }
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=ok`, req.url));
  } catch (err) {
    console.error("meta_oauth_callback_error", err);
    return NextResponse.redirect(new URL(`${META_OAUTH_RETURN_PATH}?meta=error`, req.url));
  }
}
