import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateInboundToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInboundToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inboundTokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function publicRequestOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const proto =
    req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  if (forwardedHost) {
    return `${proto}://${forwardedHost.split(",")[0]!.trim()}`;
  }
  return url.origin;
}

export function publicFormUrl(origin: string, publicToken: string): string {
  return `${origin.replace(/\/$/, "")}/f/${publicToken}`;
}

export function publicFormEmbedUrl(origin: string, publicToken: string): string {
  return `${publicFormUrl(origin, publicToken)}?embed=1`;
}

export function publicFormEmbedSnippet(origin: string, publicToken: string): string {
  const src = publicFormEmbedUrl(origin, publicToken);
  return `<iframe src="${src}" title="Formulário no site" width="100%" height="520" style="border:0;border-radius:8px;"></iframe>`;
}

export function inboundLeadsUrl(origin: string, endpointId?: string): string {
  const base = `${origin.replace(/\/$/, "")}/api/webhooks/leads`;
  return endpointId ? `${base}/${endpointId}` : base;
}
