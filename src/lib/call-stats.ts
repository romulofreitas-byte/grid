const SAO_PAULO = "America/Sao_Paulo";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Civil date in America/Sao_Paulo (`YYYY-MM-DD`). */
export function saoPauloDay(input: Date | string): string {
  return dayFmt.format(typeof input === "string" ? new Date(input) : input);
}

export function uniqueCallDays(createdAt: string[]): string[] {
  return [...new Set(createdAt.map(saoPauloDay))].sort();
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + delta, 15);
  return saoPauloDay(new Date(utc));
}

/**
 * Consecutive days with ≥1 call. Still alive through today if yesterday
 * had a call (does not reset until a full civil day is missed).
 */
export function callStreak(createdAt: string[], now: Date = new Date()): number {
  const days = new Set(uniqueCallDays(createdAt));
  if (days.size === 0) return 0;
  const today = saoPauloDay(now);
  const yesterday = shiftDay(today, -1);
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;
  let n = 0;
  while (cursor && days.has(cursor)) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

export function callsOnDay(createdAt: string[], day: string): number {
  return createdAt.filter((iso) => saoPauloDay(iso) === day).length;
}
