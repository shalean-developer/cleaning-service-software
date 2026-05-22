"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconCalendar, IconChevron } from "./icons";
import {
  WEEKDAY_LABELS,
  addDaysToIsoDate,
  buildMonthGrid,
  canNavigateMonth,
  formatMarketingDisplayDate,
  formatMonthYearLabel,
  monthIndexFromIso,
  todayIsoDateLocal,
} from "./marketingDateUtils";

type MarketingDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  ariaLabel?: string;
  className?: string;
  iconLeft?: ReactNode;
};

const triggerBaseClass =
  "marketing-focus-ring flex h-14 w-full items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-left text-[0.9375rem] text-shalean-navy outline-none transition hover:border-slate-300 focus:border-shalean-primary/80 focus:ring-[3px] focus:ring-shalean-primary/10";

const PANEL_GAP_PX = 8;
const PANEL_ESTIMATED_HEIGHT_PX = 340;
const PANEL_Z_INDEX = 60;

const panelClass =
  "min-w-[17.5rem] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)] sm:min-w-[19rem]";

function ChevronNavIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d={direction === "left" ? "M12.5 5 7.5 10l5 5" : "m7.5 5 5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketingDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  ariaLabel = "Date",
  className = "",
  iconLeft,
}: MarketingDatePickerProps) {
  const resolvedMinDate = minDate ?? todayIsoDateLocal();
  const resolvedMaxDate = maxDate ?? addDaysToIsoDate(resolvedMinDate, 90);
  const today = useMemo(() => todayIsoDateLocal(), []);

  const [open, setOpen] = useState(false);
  const initialView = monthIndexFromIso(value);
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonthIndex, setViewMonthIndex] = useState(initialView.monthIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const displayLabel = formatMarketingDisplayDate(value);
  const monthLabel = formatMonthYearLabel(viewYear, viewMonthIndex);

  const cells = useMemo(
    () =>
      buildMonthGrid(
        viewYear,
        viewMonthIndex,
        resolvedMinDate,
        resolvedMaxDate,
        value,
        today,
      ),
    [resolvedMaxDate, resolvedMinDate, today, value, viewMonthIndex, viewYear],
  );

  const canGoBack = canNavigateMonth(
    viewYear,
    viewMonthIndex,
    -1,
    resolvedMinDate,
    resolvedMaxDate,
  );
  const canGoForward = canNavigateMonth(
    viewYear,
    viewMonthIndex,
    1,
    resolvedMinDate,
    resolvedMaxDate,
  );

  const close = useCallback(() => setOpen(false), []);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.max(rect.width, 280);
    const maxLeft = window.innerWidth - width - viewportPadding;
    const left = Math.max(viewportPadding, Math.min(rect.left, maxLeft));

    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP_PX;
    const openAbove =
      spaceBelow < PANEL_ESTIMATED_HEIGHT_PX &&
      rect.top > PANEL_ESTIMATED_HEIGHT_PX + PANEL_GAP_PX;

    if (openAbove) {
      setPanelStyle({
        position: "fixed",
        left,
        width,
        bottom: window.innerHeight - rect.top + PANEL_GAP_PX,
        zIndex: PANEL_Z_INDEX,
      });
      return;
    }

    setPanelStyle({
      position: "fixed",
      top: rect.bottom + PANEL_GAP_PX,
      left,
      width,
      zIndex: PANEL_Z_INDEX,
    });
  }, []);

  const selectDate = useCallback(
    (iso: string) => {
      onChange(iso);
      close();
    },
    [close, onChange],
  );

  const shiftMonth = useCallback((direction: -1 | 1) => {
    setViewMonthIndex((month) => {
      const next = month + direction;
      if (next < 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      if (next > 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    updatePanelPosition();

    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const { year, monthIndex } = monthIndexFromIso(value);
    setViewYear(year);
    setViewMonthIndex(monthIndex);
  }, [open, value]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  };

  const leftIcon = iconLeft ?? (
    <IconCalendar className="h-[1.125rem] w-[1.125rem]" aria-hidden />
  );

  const calendarPanel = open && panelStyle ? (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={ariaLabel}
      className={panelClass}
      style={panelStyle}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => shiftMonth(-1)}
          className="marketing-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronNavIcon direction="left" />
        </button>
        <p className="text-sm font-semibold text-shalean-navy">{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => shiftMonth(1)}
          className="marketing-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronNavIcon direction="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendar">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (cell.iso == null) {
            return <div key={`pad-${index}`} role="gridcell" aria-hidden />;
          }

          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              disabled={cell.disabled}
              aria-label={formatMarketingDisplayDate(cell.iso)}
              aria-selected={cell.isSelected}
              onClick={() => selectDate(cell.iso!)}
              className={`marketing-focus-ring mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition ${
                cell.isSelected
                  ? "bg-shalean-primary text-white shadow-sm shadow-blue-500/25"
                  : cell.isToday
                    ? "text-shalean-primary ring-1 ring-shalean-primary/30 hover:bg-shalean-soft-blue/50"
                    : cell.disabled
                      ? "cursor-not-allowed text-slate-300"
                      : "text-shalean-navy hover:bg-shalean-soft-blue/50"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`relative overflow-visible ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${ariaLabel}: ${displayLabel}`}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`${triggerBaseClass} pl-12 ${open ? "border-shalean-primary/80 ring-[3px] ring-shalean-primary/10" : ""}`}
      >
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {leftIcon}
        </span>
        <span className="min-w-0 flex-1 truncate font-normal">{displayLabel}</span>
        <IconChevron
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {portalReady && calendarPanel
        ? createPortal(calendarPanel, document.body)
        : null}
    </div>
  );
}
