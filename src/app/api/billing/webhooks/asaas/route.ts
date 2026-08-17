import { NextResponse } from "next/server";
import { asaasProvider } from "@/lib/billing/providers/asaas";
import { handleNormalizedEvent } from "@/lib/billing/service";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const event = await asaasProvider.parseWebhook(req, raw);
    if (event) await handleNormalizedEvent(event, JSON.parse(raw || "{}"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
