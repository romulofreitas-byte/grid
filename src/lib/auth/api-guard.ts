import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  clientIp,
  rateLimit,
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
): Promise<{ userId: string } | NextResponse> {
  const hit = rateLimit(clientIp(req), bucket);
  if (!hit.ok) return limitedResponse(hit.resetAt);
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return { userId: session.id };
}

export async function guardPublicApi(
  req: Request,
  bucket: RateBucket,
): Promise<NextResponse | null> {
  const hit = rateLimit(clientIp(req), bucket);
  if (!hit.ok) return limitedResponse(hit.resetAt);
  return null;
}

export function isGuardReject(
  value: { userId: string } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
