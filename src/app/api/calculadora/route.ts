import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import type { CalculadoraPayload } from "@/lib/calculadora/payload";
import {
  calculateFunnel,
  defaultFunnelPlan,
  parseFunnelPlan,
  sanitizeFunnelPlanPatch,
} from "@/lib/calculadora/funnel";
import { loadCrmSuggestions } from "@/lib/calculadora/load";
import { getRepo } from "@/lib/data";
import { clampCallGoal } from "@/lib/pilot-profile";

async function payload(userId: string): Promise<CalculadoraPayload> {
  const repo = getRepo();
  const [profile, suggestions] = await Promise.all([
    repo.getProfile(userId),
    loadCrmSuggestions(userId),
  ]);
  return {
    plan: parseFunnelPlan(profile.funnel_plan) ?? defaultFunnelPlan(),
    metaLigacoesDia: profile.meta_ligacoes_dia,
    suggestions,
  };
}

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    return NextResponse.json(await payload(gated.userId));
  } catch (err) {
    console.error("calculadora_get_error", err);
    return NextResponse.json(
      { error: "Não foi possível carregar a calculadora" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const apply = raw.apply === true;
  const plan = sanitizeFunnelPlanPatch(raw.plan ?? raw);
  try {
    if (apply) {
      const result = calculateFunnel({ ...plan, now: new Date() });
      if (!result.ready || result.ligacoesPorDia < 1) {
        return NextResponse.json(
          { error: "Preencha meta, ticket e prazo para aplicar no Box." },
          { status: 400 },
        );
      }
      plan.appliedAt = new Date().toISOString();
      await getRepo().updateProfile(gated.userId, {
        funnel_plan: plan,
        meta_ligacoes_dia: clampCallGoal(result.ligacoesPorDia),
      });
    } else {
      await getRepo().updateProfile(gated.userId, { funnel_plan: plan });
    }
    return NextResponse.json(await payload(gated.userId));
  } catch (err) {
    console.error("calculadora_patch_error", err);
    return NextResponse.json(
      { error: "Não foi possível salvar a calculadora" },
      { status: 500 },
    );
  }
}
