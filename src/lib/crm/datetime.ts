const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

export { WEEKDAYS };

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

export type MonthCell = {
  day: number;
  inMonth: boolean;
  key: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseDatetimeLocal(value: string): LocalParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hours: Number(match[4]),
    minutes: Number(match[5]),
  };
}

export function formatDatetimeLocal(parts: LocalParts): string {
  return `${ymd(parts.year, parts.month, parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`;
}

export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];

  for (let i = 0; i < startPad; i += 1) {
    const day = prevDays - startPad + i + 1;
    const prev = new Date(year, month - 1, day);
    cells.push({
      day,
      inMonth: false,
      key: ymd(prev.getFullYear(), prev.getMonth(), prev.getDate()),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      inMonth: true,
      key: ymd(year, month, day),
    });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const next = new Date(year, month + 1, nextDay);
    cells.push({
      day: nextDay,
      inMonth: false,
      key: ymd(next.getFullYear(), next.getMonth(), next.getDate()),
    });
    nextDay += 1;
  }

  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const cursor = new Date(year, month + delta, 1);
  return { year: cursor.getFullYear(), month: cursor.getMonth() };
}

export function clampMinutes(value: number, step = 5): number {
  const rounded = Math.round(value / step) * step;
  if (rounded >= 60) return 0;
  if (rounded < 0) return 60 - step;
  return rounded;
}

export function parseTimeInput(
  raw: string,
): { hours: number; minutes: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [hRaw, mRaw = "0"] = trimmed.split(":");
    if (hRaw === "" || !/^\d{1,2}$/.test(hRaw) || !/^\d{0,2}$/.test(mRaw)) {
      return null;
    }
    const hours = Number(hRaw);
    const minutes = Number(mRaw || "0");
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 2) {
    const hours = Number(digits);
    if (hours > 23) return null;
    return { hours, minutes: 0 };
  }
  if (digits.length === 3) {
    const hours = Number(digits.slice(0, 1));
    const minutes = Number(digits.slice(1));
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function formatTimeInput(hours: number, minutes: number): string {
  return `${pad(hours)}:${pad(minutes)}`;
}

export function timeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function maskTimeDigits(digits: string): string {
  const d = timeDigits(digits);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function completeTimeDigits(digits: string): string {
  const d = timeDigits(digits);
  if (d.length === 0) return "";
  if (d.length === 1) return `0${d}00`;
  if (d.length === 2) return `${d}00`;
  if (d.length === 3) {
    return Number(d.slice(0, 2)) <= 23 ? `${d}0` : `0${d}`;
  }
  return d.slice(0, 4);
}

export function formatDateInput(
  year: number,
  month: number,
  day: number,
): string {
  return `${pad(day)}/${pad(month + 1)}/${year}`;
}

export function dateDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function maskDateDigits(digits: string): string {
  const d = dateDigits(digits);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function parseDateInput(
  raw: string,
): { year: number; month: number; day: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let day: number;
  let month: number;
  let year: number;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slash) {
    day = Number(slash[1]);
    month = Number(slash[2]);
    year = Number(slash[3]);
  } else {
    const digits = dateDigits(trimmed);
    if (digits.length !== 8) return null;
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = Number(digits.slice(4, 8));
  }
  if (month < 1 || month > 12 || day < 1 || year < 1000) return null;
  const stamp = new Date(year, month - 1, day);
  if (
    stamp.getFullYear() !== year ||
    stamp.getMonth() !== month - 1 ||
    stamp.getDate() !== day
  ) {
    return null;
  }
  return { year, month: month - 1, day };
}



