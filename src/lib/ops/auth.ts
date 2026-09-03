import { createHmac, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE = "grid_ops";
export const OPS_SESSION_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_OPS_EMAIL = "administracao@combustivelmv.com";

export function opsEmail(): string {
  return (process.env.GRID_OPS_EMAIL?.trim() || DEFAULT_OPS_EMAIL).toLowerCase();
}

export function opsPassword(): string {
  return process.env.GRID_OPS_PASSWORD?.trim() ?? "";
}

export function opsSigningSecret(): string {
  return process.env.GRID_OPS_SECRET?.trim() || opsPassword();
}

export function opsCredentialsConfigured(): boolean {
  return Boolean(opsPassword() && opsSigningSecret());
}

export function opsCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.GRID_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(OPS_SESSION_MS / 1000),
  };
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  const size = Math.max(left.length, right.length, 1);
  const paddedLeft = Buffer.alloc(size);
  const paddedRight = Buffer.alloc(size);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length;
}

export function credentialsMatch(email: string, password: string): boolean {
  if (!opsCredentialsConfigured()) return false;
  const emailOk = safeEqualString(email.trim().toLowerCase(), opsEmail());
  const passwordOk = safeEqualString(password, opsPassword());
  return emailOk && passwordOk;
}

export function signOpsToken(now = Date.now()): string {
  const exp = String(now + OPS_SESSION_MS);
  const sig = createHmac("sha256", opsSigningSecret())
    .update(exp)
    .digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyOpsToken(token: string, now = Date.now()): boolean {
  if (!opsCredentialsConfigured()) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || now > exp) return false;
  const expected = createHmac("sha256", opsSigningSecret())
    .update(expRaw)
    .digest("base64url");
  return safeEqualString(sig, expected);
}

export function readOpsCookieFromHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== OPS_COOKIE) continue;
    const value = rest.join("=").trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function isOpsRequestAuthenticated(req: Request, now = Date.now()): boolean {
  const token = readOpsCookieFromHeader(req.headers.get("cookie"));
  return Boolean(token && verifyOpsToken(token, now));
}
