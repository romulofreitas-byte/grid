import type { EmailOtpType } from "@supabase/supabase-js";
import { parseEmailOtpType } from "@/lib/auth/otp";

export type CallbackParams =
  | { kind: "verify"; tokenHash: string; type: EmailOtpType }
  | { kind: "oauth"; code: string }
  | { kind: "missing" };

export function parseCallbackParams(
  searchParams: Pick<URLSearchParams, "get">,
): CallbackParams {
  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailOtpType(searchParams.get("type"));
  if (tokenHash && type) return { kind: "verify", tokenHash, type };
  const code = searchParams.get("code");
  if (code) return { kind: "oauth", code };
  return { kind: "missing" };
}
