import type { EmailOtpType } from "@supabase/supabase-js";

const TYPES = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

export function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  return TYPES.has(raw as EmailOtpType) ? (raw as EmailOtpType) : null;
}
