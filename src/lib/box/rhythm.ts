import { callsOnDay, saoPauloDay } from "@/lib/call-stats";
import { lastNDays } from "@/lib/painel/period";

export type BoxHabitPoint = {
  day: string;
  calls: number;
  meta: number;
};

export type BoxRhythm = {
  callsToday: number;
  callGoal: number;
  habit: BoxHabitPoint[];
  crmCallsToday: number;
  crmWhatsappToday: number;
  crmMeetingsToday: number;
};

export function emptyBoxRhythm(callGoal: number): BoxRhythm {
  return {
    callsToday: 0,
    callGoal,
    habit: [],
    crmCallsToday: 0,
    crmWhatsappToday: 0,
    crmMeetingsToday: 0,
  };
}

export function rhythmNeedsPulse(
  rhythm: Pick<BoxRhythm, "callsToday" | "callGoal">,
  overdueCount: number,
): boolean {
  if (overdueCount > 0) return true;
  return rhythm.callGoal > 0 && rhythm.callsToday < rhythm.callGoal;
}

export function buildBoxRhythm(input: {
  now: Date;
  callGoal: number;
  callCreatedAt: readonly string[];
  crmEvents: readonly { kind: string; created_at: string }[];
}): BoxRhythm {
  const goal = input.callGoal > 0 ? input.callGoal : 0;
  const today = saoPauloDay(input.now);
  const stamps = [...input.callCreatedAt];
  return {
    callsToday: callsOnDay(stamps, today),
    callGoal: goal,
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
