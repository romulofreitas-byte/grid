import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { loadBoxQueue, BoxQueueError } from "@/lib/box/load-queue";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    return NextResponse.json(await loadBoxQueue(gated.userId));
  } catch (err) {
    if (err instanceof BoxQueueError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível carregar a fila" },
      { status: 500 },
    );
  }
}
