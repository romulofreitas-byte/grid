import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { loadCrmSuggestions } from "@/lib/calculadora/load";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    return NextResponse.json({
      suggestions: await loadCrmSuggestions(gated.userId),
    });
  } catch (err) {
    console.error("metas_suggestions_error", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as taxas do CRM" },
      { status: 500 },
    );
  }
}
