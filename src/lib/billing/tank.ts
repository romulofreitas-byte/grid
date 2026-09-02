import { COPY } from "@/lib/copy";
import { ENRICH_CREDIT_COST } from "@/lib/billing/catalog";
import { DEFAULT_CALL_GOAL } from "@/lib/pilot-profile";

export function qualifyDaysRemaining(
  credits: number,
  dailyGoal: number,
  cost = ENRICH_CREDIT_COST,
): number {
  const perDay = Math.max(0, dailyGoal) * cost;
  if (perDay <= 0 || credits <= 0) return 0;
  return Math.floor(credits / perDay);
}

export function tankDaysLabel(days: number, enrichAllowed: boolean): string {
  if (!enrichAllowed) return "Plano";
  return days === 1 ? "1 dia" : `${days} dias`;
}

export function tankHint(input: {
  enrichAllowed: boolean;
  credits: number;
  dailyGoal: number;
  cost?: number;
}): string {
  const goal = input.dailyGoal > 0 ? input.dailyGoal : DEFAULT_CALL_GOAL;
  const cost = input.cost ?? ENRICH_CREDIT_COST;
  if (!input.enrichAllowed) return COPY.boxAcessoHintLocked;
  const days = qualifyDaysRemaining(input.credits, goal, cost);
  if (days <= 0) {
    return COPY.boxAcessoHintZero
      .replace("{goal}", String(goal))
      .replace("{credits}", String(input.credits))
      .replace("{cost}", String(cost));
  }
  return COPY.boxAcessoHint
    .replace("{days}", String(days))
    .replace("{dayWord}", days === 1 ? "dia" : "dias")
    .replace("{goal}", String(goal))
    .replace("{credits}", String(input.credits))
    .replace("{cost}", String(cost));
}
