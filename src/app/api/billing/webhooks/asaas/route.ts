import { NextResponse } from "next/server";
import { asaasProvider } from "@/lib/billing/providers/asaas";
import { handleNormalizedEvent } from "@/lib/billing/service";

/** Asaas may probe the URL; 405 here would pause the delivery queue. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = await asaasProvider.parseWebhook(req, raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook";
    return NextResponse.json({ error: message }, { status: 401 });
  }
  try {
    if (event) {
      await handleNormalizedEvent(event, JSON.parse(raw || "{}"));
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook";
    console.error("asaas webhook handler:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
