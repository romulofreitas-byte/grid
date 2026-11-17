import { callsOnDay, saoPauloDay } from "@/lib/call-stats";
import { resolveDecisorGoal } from "@/lib/calculadora/funnel";
import { lastNDays } from "@/lib/painel/period";

export type BoxHabitPoint = {
  day: string;
  calls: number;
  meta: number;
};

export type BoxRhythm = {
  callsToday: number;
  callGoal: number;
  decisorToday: number;
  decisorGoal: number;
  habit: BoxHabitPoint[];
  crmCallsToday: number;
  crmWhatsappToday: number;
  crmMeetingsToday: number;
};

export function emptyBoxRhythm(callGoal: number): BoxRhythm {
  return {
    callsToday: 0,
    callGoal,
    decisorToday: 0,
    decisorGoal: resolveDecisorGoal(null, callGoal),
    habit: [],
    crmCallsToday: 0,
    crmWhatsappToday: 0,
    crmMeetingsToday: 0,
  };
}

export function rhythmNeedsPulse(
  rhythm: Pick<BoxRhythm, "callsToday" | "callGoal"> &
    Partial<Pick<BoxRhythm, "decisorToday" | "decisorGoal">>,
  overdueCount: number,
): boolean {
  if (overdueCount > 0) return true;
  const dialsShort = rhythm.callGoal > 0 && rhythm.callsToday < rhythm.callGoal;
  const decisorShort =
    (rhythm.decisorGoal ?? 0) > 0 &&
    (rhythm.decisorToday ?? 0) < (rhythm.decisorGoal ?? 0);
  return dialsShort || decisorShort;
}

export function buildBoxRhythm(input: {
  now: Date;
  callGoal: number;
  decisorGoal?: number | null;
  callCreatedAt: readonly string[];
  decisorCreatedAt?: readonly string[];
  crmEvents: readonly { kind: string; created_at: string }[];
}): BoxRhythm {
  const goal = input.callGoal > 0 ? input.callGoal : 0;
  const today = saoPauloDay(input.now);
  const stamps = [...input.callCreatedAt];
  const decisorStamps = [...(input.decisorCreatedAt ?? [])];
  return {
    callsToday: callsOnDay(stamps, today),
    callGoal: goal,
    decisorToday: callsOnDay(decisorStamps, today),
    decisorGoal: resolveDecisorGoal(input.decisorGoal, goal),
    habit: lastNDays(input.now, 14).map((day) => ({
      day,
      calls: callsOnDay(stamps, day),
      meta: goal,
    })),
    crmCallsToday: input.crmEvents.filter(
      (row) => row.kind === "ligar" && saoPauloDay(row.created_at) === today,
    ).length,
    crmWhatsappToday: input.crmEvents.filter(
      (row) => row.kind === "whatsapp" && saoPauloDay(row.created_at) === today,
    ).length,
    crmMeetingsToday: input.crmEvents.filter(
      (row) => row.kind === "reuniao" && saoPauloDay(row.created_at) === today,
    ).length,
  };
}
