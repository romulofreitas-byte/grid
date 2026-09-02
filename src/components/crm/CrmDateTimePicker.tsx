"use client";

import { AnchorPopover } from "@/components/AnchorPopover";
import { COPY } from "@/lib/copy";
import { saoPauloDay } from "@/lib/call-stats";
import {
  WEEKDAYS,
  completeTimeDigits,
  formatDateInput,
  formatDatetimeLocal,
  formatTimeInput,
  maskDateDigits,
  maskTimeDigits,
  monthCells,
  parseDateInput,
  parseDatetimeLocal,
  parseTimeInput,
  shiftMonth,
  dateDigits,
  timeDigits,
  ymd,
  type LocalParts,
} from "@/lib/crm/datetime";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  variant = "dark",
}: {
  value: string;
  onChange: (value: string) => void;
  variant?: "dark" | "light";
}) {
  const light = variant === "light";
  const parts = partsFromValue(value);
  const todayKey = saoPauloDay(new Date());
  const selectedKey = ymd(parts.year, parts.month, parts.day);
  const [viewYear, setViewYear] = useState(parts.year);
  const [viewMonth, setViewMonth] = useState(parts.month);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const cells = useMemo(
    () => monthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const heading = format(new Date(viewYear, viewMonth, 1), "MMMM yyyy", {
    locale: ptBR,
  });
  const dateLabel = formatDateInput(parts.year, parts.month, parts.day);
  const clock = formatTimeInput(parts.hours, parts.minutes);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const timeRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const dateAnchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!calendarOpen) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [parts.year, parts.month, calendarOpen]);

  useEffect(() => {
    if (!calendarOpen) return;
    function onDoc(event: MouseEvent) {
      const t = event.target as Node;
      if (dateAnchorRef.current?.contains(t) || panelRef.current?.contains(t)) {
        return;
      }
      setCalendarOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setCalendarOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [calendarOpen]);

  function commit(next: LocalParts) {
    onChange(formatDatetimeLocal(next));
  }

  function applyTimeDigits(raw: string) {
    const parsed = parseTimeInput(maskTimeDigits(completeTimeDigits(raw)));
    if (!parsed) return;
    commit({ ...parts, ...parsed });
  }

  function applyDateDraft(raw: string) {
    const parsed = parseDateInput(maskDateDigits(dateDigits(raw)));
    if (!parsed) return;
    commit({ ...parts, ...parsed });
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
  }

  function pickDay(key: string) {
    const [year, month, day] = key.split("-").map(Number);
    commit({
      ...parts,
      year: year!,
      month: month! - 1,
      day: day!,
    });
    setViewYear(year!);
    setViewMonth(month! - 1);
    setCalendarOpen(false);
    setEditingDate(false);
    setDateDraft("");
  }

  function jumpMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
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
    setViewYear(stamp.getFullYear());
    setViewMonth(stamp.getMonth());
    setCalendarOpen(false);
    setEditingDate(false);
    setDateDraft("");
  }

  const fieldClass = cn(
    "w-full rounded-md border px-2 py-1 font-mono text-xs font-normal outline-none",
    light
      ? "border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-amber-400"
      : "border-white/10 bg-white/[0.04] text-podium-white placeholder:text-podium-muted focus:border-podium-yellow/40",
  );

  const labelClass = cn(
    "text-[10px] font-medium uppercase tracking-[0.12em]",
    light ? "text-zinc-500" : "text-podium-muted",
  );

  return (
    <div className="grid w-full max-w-xs grid-cols-2 gap-2">
      <div ref={dateAnchorRef} className="min-w-0">
        <label className="block">
          <span className={labelClass}>{COPY.crmDeadlineLabel}</span>
          <input
            ref={dateRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            aria-label={COPY.crmDeadlineLabel}
            aria-expanded={calendarOpen}
            aria-controls={panelId}
            placeholder="00/00/0000"
            value={editingDate ? maskDateDigits(dateDraft) : dateLabel}
            onMouseDown={() => {
              setCalendarOpen(true);
            }}
            onFocus={() => {
              setCalendarOpen(true);
              if (!editingDate) {
                setDateDraft(dateDigits(dateLabel));
                setEditingDate(true);
              }
            }}
            onChange={(event) => {
              const next = dateDigits(event.target.value);
              setDateDraft(next);
              requestAnimationFrame(() => {
                const el = dateRef.current;
                if (!el) return;
                const pos = maskDateDigits(next).length;
                el.setSelectionRange(pos, pos);
              });
              if (next.length === 8) {
                applyDateDraft(next);
                setEditingDate(false);
              }
            }}
            onBlur={() => {
              if (dateDraft.length > 0) applyDateDraft(dateDraft);
              setEditingDate(false);
              setDateDraft("");
            }}
            className={cn(fieldClass, "mt-1")}
          />
        </label>
        <AnchorPopover
          open={calendarOpen}
          anchorRef={dateAnchorRef}
          panelRef={panelRef}
          id={panelId}
          className={cn(
            "w-[17.5rem] overflow-hidden p-0",
            light ? "border-zinc-200 bg-white shadow-lg" : null,
          )}
        >
          <header
            className={cn(
              "flex items-center justify-between border-b px-3 py-2",
              light ? "border-zinc-100" : "border-white/[0.06]",
            )}
          >
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => jumpMonth(-1)}
              className={cn(
                "rounded-md p-1",
                light
                  ? "text-zinc-400 hover:text-zinc-800"
                  : "text-podium-muted hover:text-podium-yellow",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.12em]",
                light ? "text-zinc-600" : "text-podium-yellow",
              )}
            >
              {heading}
            </p>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => jumpMonth(1)}
              className={cn(
                "rounded-md p-1",
                light
                  ? "text-zinc-400 hover:text-zinc-800"
                  : "text-podium-muted hover:text-podium-yellow",
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-7 gap-0.5 px-2 pt-2">
            {WEEKDAYS.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className={cn(
                  "pb-1 text-center text-[10px] font-medium uppercase tracking-[0.12em]",
                  light ? "text-zinc-400" : "text-podium-muted",
                )}
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
                    "h-7 rounded-md text-[11px] transition",
                    !cell.inMonth &&
                      (light ? "text-zinc-300" : "text-podium-muted/40"),
                    cell.inMonth &&
                      !selected &&
                      (light
                        ? "text-zinc-600 hover:bg-zinc-100"
                        : "text-podium-gray hover:bg-white/[0.06]"),
                    today &&
                      !selected &&
                      (light ? "text-amber-600" : "text-podium-yellow"),
                    selected &&
                      "bg-podium-yellow font-semibold text-podium-navy hover:bg-podium-yellow",
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div
            className={cn(
              "mt-1.5 flex flex-wrap gap-1.5 border-t px-3 py-2",
              light ? "border-zinc-100" : "border-white/[0.06]",
            )}
          >
            <button
              type="button"
              onClick={() => setQuick(0)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px]",
                light
                  ? "border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-zinc-800"
                  : "border-white/10 text-podium-muted hover:border-podium-yellow/30 hover:text-podium-yellow",
              )}
            >
              {COPY.crmToday}
            </button>
            <button
              type="button"
              onClick={() => setQuick(1)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px]",
                light
                  ? "border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-zinc-800"
                  : "border-white/10 text-podium-muted hover:border-podium-yellow/30 hover:text-podium-yellow",
              )}
            >
              {COPY.crmTomorrow}
            </button>
            <button
              type="button"
              onClick={() => setQuick(7)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px]",
                light
                  ? "border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-zinc-800"
                  : "border-white/10 text-podium-muted hover:border-podium-yellow/30 hover:text-podium-yellow",
              )}
            >
              {COPY.crmWeekLater}
            </button>
          </div>
        </AnchorPopover>
      </div>
      <label className="min-w-0">
        <span className={labelClass}>{COPY.crmTimeLabel}</span>
        <input
          ref={timeRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          aria-label={COPY.crmTimeLabel}
          placeholder="00:00"
          value={editingTime ? maskTimeDigits(timeDraft) : clock}
          onMouseDown={() => {
            if (editingTime) return;
            flushSync(() => {
              setEditingTime(true);
              setTimeDraft("");
            });
          }}
          onFocus={(event) => {
            setEditingTime(true);
            event.currentTarget.setSelectionRange(0, 0);
          }}
          onChange={(event) => {
            const next = timeDigits(event.target.value);
            setTimeDraft(next);
            requestAnimationFrame(() => {
              const el = timeRef.current;
              if (!el) return;
              const pos = maskTimeDigits(next).length;
              el.setSelectionRange(pos, pos);
            });
            if (next.length === 4) {
              applyTimeDigits(next);
              setEditingTime(false);
              timeRef.current?.blur();
            }
          }}
          onBlur={() => {
            if (timeDraft.length > 0) applyTimeDigits(timeDraft);
            setEditingTime(false);
            setTimeDraft("");
          }}
          className={cn(fieldClass, "mt-1")}
        />
      </label>
    </div>
  );
}
