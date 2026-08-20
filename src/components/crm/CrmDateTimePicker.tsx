"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saoPauloDay } from "@/lib/call-stats";
import {
  WEEKDAYS,
  completeTimeDigits,
  formatDatetimeLocal,
  formatTimeInput,
  maskTimeDigits,
  monthCells,
  parseDatetimeLocal,
  parseTimeInput,
  shiftMonth,
  timeDigits,
  ymd,
  type LocalParts,
} from "@/lib/crm/datetime";
import { cn } from "@/lib/utils";

function partsFromValue(value: string, fallback = new Date()): LocalParts {
  return (
    parseDatetimeLocal(value) ?? {
      year: fallback.getFullYear(),
      month: fallback.getMonth(),
      day: fallback.getDate(),
      hours: fallback.getHours(),
      minutes: fallback.getMinutes(),
    }
  );
}

export function CrmDateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = partsFromValue(value);
  const todayKey = saoPauloDay(new Date());
  const selectedKey = ymd(parts.year, parts.month, parts.day);
  const cells = useMemo(
    () => monthCells(parts.year, parts.month),
    [parts.year, parts.month],
  );
  const heading = format(new Date(parts.year, parts.month, 1), "MMMM yyyy", {
    locale: ptBR,
  });
  const clock = formatTimeInput(parts.hours, parts.minutes);
  const [editing, setEditing] = useState(false);
  const [digits, setDigits] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(next: LocalParts) {
    onChange(formatDatetimeLocal(next));
  }

  function applyDigits(raw: string) {
    const parsed = parseTimeInput(maskTimeDigits(completeTimeDigits(raw)));
    if (!parsed) return;
    commit({ ...parts, ...parsed });
  }

  function pickDay(key: string) {
    const [year, month, day] = key.split("-").map(Number);
    commit({
      ...parts,
      year: year!,
      month: month! - 1,
      day: day!,
    });
  }

  function jumpMonth(delta: number) {
    const next = shiftMonth(parts.year, parts.month, delta);
    const daysInMonth = new Date(next.year, next.month + 1, 0).getDate();
    commit({
      ...parts,
      year: next.year,
      month: next.month,
      day: Math.min(parts.day, daysInMonth),
    });
  }

  function setQuick(daysFromToday: number) {
    const stamp = new Date();
    stamp.setDate(stamp.getDate() + daysFromToday);
    commit({
      ...parts,
      year: stamp.getFullYear(),
      month: stamp.getMonth(),
      day: stamp.getDate(),
    });
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-podium-navy/40">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => jumpMonth(-1)}
          className="rounded-lg p-1 text-podium-muted hover:text-podium-yellow"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-podium-yellow">
          {heading}
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => jumpMonth(1)}
          className="rounded-lg p-1 text-podium-muted hover:text-podium-yellow"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-7 gap-0.5 px-2 pt-2">
        {WEEKDAYS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted"
          >
            {label}
          </span>
        ))}
        {cells.map((cell) => {
          const selected = cell.key === selectedKey;
          const today = cell.key === todayKey;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => pickDay(cell.key)}
              className={cn(
                "h-8 rounded-lg text-xs transition",
                !cell.inMonth && "text-podium-muted/40",
                cell.inMonth && !selected && "text-podium-gray hover:bg-white/[0.06]",
                today && !selected && "text-podium-yellow",
                selected &&
                  "bg-podium-yellow font-extrabold text-podium-navy hover:bg-podium-yellow",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2.5">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setQuick(0)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-podium-muted hover:border-podium-yellow/30 hover:text-podium-yellow"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setQuick(1)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-podium-muted hover:border-podium-yellow/30 hover:text-podium-yellow"
          >
            Amanhã
          </button>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
            Hora
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={5}
            aria-label="Horário"
            placeholder="00:00"
            value={editing ? maskTimeDigits(digits) : clock}
            onMouseDown={() => {
              if (editing) return;
              flushSync(() => {
                setEditing(true);
                setDigits("");
              });
            }}
            onFocus={(event) => {
              setEditing(true);
              event.currentTarget.setSelectionRange(0, 0);
            }}
            onChange={(event) => {
              const next = timeDigits(event.target.value);
              setDigits(next);
              requestAnimationFrame(() => {
                const el = inputRef.current;
                if (!el) return;
                const pos = maskTimeDigits(next).length;
                el.setSelectionRange(pos, pos);
              });
              if (next.length === 4) {
                applyDigits(next);
                setEditing(false);
                inputRef.current?.blur();
              }
            }}
            onBlur={() => {
              if (digits.length > 0) applyDigits(digits);
              setEditing(false);
              setDigits("");
            }}
            className="w-[4.6rem] rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center font-mono text-sm font-semibold text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40"
          />
        </label>
      </div>
    </div>
  );
}
