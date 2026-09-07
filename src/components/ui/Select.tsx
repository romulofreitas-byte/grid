"use client";

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export type SelectSize = "sm" | "md";
export type SelectTone = "dark" | "light";

const SIZE: Record<SelectSize, string> = {
  sm: "h-11 rounded-md px-2.5 text-base md:h-7 md:text-[11px]",
  md: "h-11 rounded-lg px-3 text-base md:h-9 md:text-xs",
};

const TONE: Record<
  SelectTone,
  { trigger: string; panel: string; option: string; active: string; selected: string }
> = {
  dark: {
    trigger:
      "border-white/10 bg-podium-panel text-podium-white hover:border-white/20 focus-visible:ring-podium-yellow/40",
    panel:
      "rounded-lg border-white/10 bg-podium-panel p-0 shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
    option: "text-podium-gray hover:bg-white/[0.06] hover:text-podium-white",
    active: "bg-white/[0.06] text-podium-white",
    selected: "bg-podium-yellow/12 text-podium-white",
  },
  light: {
    trigger:
      "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 focus-visible:ring-amber-400/50",
    panel:
      "rounded-lg border-zinc-200 bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
    option: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    active: "bg-zinc-100 text-zinc-900",
    selected: "bg-amber-50 text-zinc-900",
  },
};

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  size = "md",
  tone = "dark",
  className,
  name,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: SelectSize;
  tone?: SelectTone;
  className?: string;
  name?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder ?? "";
  const isPlaceholder = !selected || (Boolean(placeholder) && value === "");
  const skin = TONE[tone];
  const openRef = useRef(false);

  useEffect(() => {
    if (open && !openRef.current) {
      const selectedIndex = options.findIndex((option) => option.value === value);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
    openRef.current = open;
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (options.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        Math.min(options.length - 1, Math.max(0, index + delta)),
      );
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const option = options[activeIndex];
      if (option) pick(option.value);
    }
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex w-full min-w-0 items-center justify-between gap-2 border font-medium outline-none transition-[border-color,background-color] duration-150 ease-out focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
          SIZE[size],
          skin.trigger,
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            isPlaceholder && (tone === "light" ? "text-zinc-400" : "text-podium-muted"),
          )}
        >
          {label}
        </span>
        {selected?.hint && !isPlaceholder ? (
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium",
              tone === "light" ? "text-zinc-400" : "text-podium-muted",
            )}
          >
            {selected.hint}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnchorPopover
        open={open}
        anchorRef={buttonRef}
        panelRef={panelRef}
        id={listId}
        fade
        matchAnchorWidth
        className={skin.panel}
      >
        <div role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto p-1">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value || `empty-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={isActive ? "true" : undefined}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors duration-150 ease-out",
                  skin.option,
                  isActive && skin.active,
                  isSelected && skin.selected,
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.hint ? (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-[10px] font-medium",
                      tone === "light" ? "text-zinc-400" : "text-podium-muted",
                    )}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </AnchorPopover>
    </div>
  );
}
