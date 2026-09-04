import { saoPauloDay } from "@/lib/call-stats";
import type { PainelRange } from "@/lib/painel/types";

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + delta, 15);
  return saoPauloDay(new Date(utc));
}

/** Midnight America/Sao_Paulo as UTC ms (no DST since 2019). */
function spMidnightUtc(day: string): number {
  return Date.parse(`${day}T03:00:00.000Z`);
}

export function periodStartMs(range: PainelRange, now: Date): number | null {
  if (range === "all") return null;
  const today = saoPauloDay(now);
  if (range === "today") return spMidnightUtc(today);
  if (range === "month") return spMidnightUtc(`${today.slice(0, 7)}-01`);
  const days = range === "7d" ? 7 : 30;
  return now.getTime() - days * 86_400_000;
}

export function inPeriod(iso: string, startMs: number | null): boolean {
  if (startMs == null) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= startMs;
}

export function lastNDays(now: Date, count: number): string[] {
  const n = Math.max(1, Math.min(120, Math.floor(count)));
  const end = saoPauloDay(now);
  const days: string[] = [];
  let cursor = shiftDay(end, -(n - 1));
  while (cursor <= end) {
    days.push(cursor);
    cursor = shiftDay(cursor, 1);
    if (days.length > 120) break;
  }
  return days;
}

export function seriesDays(range: PainelRange, now: Date): string[] {
  const end = saoPauloDay(now);
  let start = end;
  if (range === "7d") start = shiftDay(end, -6);
  else if (range === "30d") start = shiftDay(end, -29);
  else if (range === "month") start = `${end.slice(0, 7)}-01`;
  else if (range === "all") start = shiftDay(end, -89);
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = shiftDay(cursor, 1);
    if (days.length > 120) break;
  }
  return days;
}
