"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IconCheck, IconChevron } from "./icons";

export type MarketingSelectOption = {
  value: string;
  label: string;
};

type MarketingSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly MarketingSelectOption[];
  ariaLabel: string;
  className?: string;
  iconLeft?: ReactNode;
};

const triggerBaseClass =
  "marketing-focus-ring flex h-14 w-full items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-left text-[0.9375rem] text-shalean-navy outline-none transition hover:border-slate-300 focus:border-shalean-primary/80 focus:ring-[3px] focus:ring-shalean-primary/10";

const listClass =
  "absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200/90 bg-white py-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]";

const optionBaseClass =
  "marketing-focus-ring flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[0.9375rem] text-shalean-navy transition";

export function MarketingSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  iconLeft,
}: MarketingSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected?.label ?? value;

  const close = useCallback(() => setOpen(false), []);

  const selectOption = useCallback(
    (opt: MarketingSelectOption) => {
      onChange(opt.value);
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((opt) => opt.value === value);
    setHighlightIndex(index >= 0 ? index : 0);
  }, [open, options, value]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        setHighlightIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightIndex((index) => Math.max(index - 1, 0));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (options[highlightIndex]) {
          selectOption(options[highlightIndex]);
        }
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`${triggerBaseClass} ${iconLeft ? "pl-12" : ""} ${open ? "border-shalean-primary/80 ring-[3px] ring-shalean-primary/10" : ""}`}
      >
        {iconLeft ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {iconLeft}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-normal">{displayLabel}</span>
        <IconChevron
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul id={listId} role="listbox" aria-label={ariaLabel} className={listClass}>
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightIndex;

            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectOption(opt)}
                className={`${optionBaseClass} ${
                  isHighlighted || isSelected
                    ? "bg-shalean-soft-blue/60"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
                {isSelected ? (
                  <IconCheck className="h-4 w-4 shrink-0 text-shalean-primary" aria-hidden />
                ) : (
                  <span className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
