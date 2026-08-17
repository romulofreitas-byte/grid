import { NextResponse } from "next/server";
import { handleNormalizedEvent } from "@/lib/billing/service";
import { parseCircleWebhook } from "@/lib/billing/treasury";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const event = await parseCircleWebhook(req, raw);
    if (event) await handleNormalizedEvent(event, JSON.parse(raw || "{}"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
