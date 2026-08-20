import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/admin";
import { requireSession } from "@/lib/auth/session";
import {
  clientIp,
  rateLimit,
  rateLimitUser,
  type RateBucket,
} from "@/lib/auth/rate-limit";

function limitedResponse(resetAt: number): NextResponse {
  const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Muitas requisições. Tente de novo em instantes." },
    {
      status: 429,
      headers: { "Retry-After": String(retry) },
    },
  );
}

export async function guardApi(
  req: Request,
  bucket: RateBucket,
): Promise<{ userId: string; email: string | null } | NextResponse> {
  const hit = await rateLimit(clientIp(req), bucket);
  if (!hit.ok) return limitedResponse(hit.resetAt);
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userHit = await rateLimitUser(session.id, bucket);
  if (!userHit.ok) return limitedResponse(userHit.resetAt);
  return { userId: session.id, email: session.email };
}

export async function guardAdminApi(
  req: Request,
  bucket: RateBucket,
): Promise<{ userId: string; email: string | null } | NextResponse> {
  const gated = await guardApi(req, bucket);
  if (gated instanceof NextResponse) return gated;
  if (!isAdminSession({ email: gated.email })) {
    return NextResponse.json({ error: "Sem permissão de admin" }, { status: 403 });
  }
  return gated;
}

export async function guardPublicApi(
  req: Request,
  bucket: RateBucket,
): Promise<NextResponse | null> {
  const hit = await rateLimit(clientIp(req), bucket);
  if (!hit.ok) return limitedResponse(hit.resetAt);
  return null;
}

export function isGuardReject(
  value: { userId: string; email?: string | null } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
