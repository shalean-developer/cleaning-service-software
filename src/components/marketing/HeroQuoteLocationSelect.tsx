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
import {
  buildHeroQuoteLocationOptions,
  filterHeroQuoteLocationOptions,
  persistQuoteLocationSelection,
  type HeroQuoteLocationOption,
} from "@/features/locations/heroQuoteLocationOptions";
import { IconCheck, IconChevron } from "./icons";

type HeroQuoteLocationSelectProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  iconLeft?: ReactNode;
};

const triggerBaseClass =
  "marketing-focus-ring flex h-14 w-full items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 text-left text-[0.9375rem] text-shalean-navy outline-none transition hover:border-slate-300 focus:border-shalean-primary/80 focus:ring-[3px] focus:ring-shalean-primary/10";

const PANEL_GAP_PX = 8;
const PANEL_MAX_HEIGHT_PX = 320;
const PANEL_Z_INDEX = 60;

const panelShellClass =
  "flex max-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]";

const optionBaseClass =
  "marketing-focus-ring flex cursor-pointer items-start justify-between gap-3 px-4 py-3 text-left text-[0.9375rem] leading-snug text-shalean-navy transition";

export function HeroQuoteLocationSelect({
  value,
  onChange,
  ariaLabel = "Location",
  className = "",
  iconLeft,
}: HeroQuoteLocationSelectProps) {
  const allOptions = useMemo(() => buildHeroQuoteLocationOptions(), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchId = useId();
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const selected = allOptions.find((opt) => opt.value === value);
  const displayLabel = selected?.label ?? value;

  const filteredOptions = useMemo(
    () => filterHeroQuoteLocationOptions(allOptions, search),
    [allOptions, search],
  );

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

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
      spaceBelow < PANEL_MAX_HEIGHT_PX && rect.top > PANEL_MAX_HEIGHT_PX + PANEL_GAP_PX;

    if (openAbove) {
      setPanelStyle({
        position: "fixed",
        left,
        width,
        bottom: window.innerHeight - rect.top + PANEL_GAP_PX,
        zIndex: PANEL_Z_INDEX,
        maxHeight: PANEL_MAX_HEIGHT_PX,
      });
      return;
    }

    setPanelStyle({
      position: "fixed",
      top: rect.bottom + PANEL_GAP_PX,
      left,
      width,
      zIndex: PANEL_Z_INDEX,
      maxHeight: PANEL_MAX_HEIGHT_PX,
    });
  }, []);

  const selectOption = useCallback(
    (opt: HeroQuoteLocationOption) => {
      onChange(opt.value);
      persistQuoteLocationSelection(opt);
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    updatePanelPosition();
    searchRef.current?.focus();

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
    const index = filteredOptions.findIndex((opt) => opt.value === value);
    setHighlightIndex(index >= 0 ? index : 0);
  }, [filteredOptions, open, value]);

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
        if (filteredOptions.length === 0) return;
        setHighlightIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (filteredOptions.length === 0) return;
        setHighlightIndex((index) => Math.max(index - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (filteredOptions[highlightIndex]) {
          selectOption(filteredOptions[highlightIndex]);
        }
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  const dropdownPanel =
    open && panelStyle ? (
      <div ref={panelRef} className={panelShellClass} style={panelStyle}>
        <div className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white p-2">
          <label htmlFor={searchId} className="sr-only">
            Search suburb
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search suburb"
            autoComplete="off"
            className="marketing-focus-ring h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-sm text-shalean-navy placeholder:text-slate-400"
          />
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5 [scrollbar-gutter:stable] [scrollbar-width:thin]"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-4 py-5 text-center" role="presentation">
              <p className="text-sm font-semibold text-shalean-navy">Location not listed</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Choose Other Cape Town area or continue with Cape Town.
              </p>
            </li>
          ) : (
            filteredOptions.map((opt, index) => {
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
                  <span className="min-w-0 flex-1">{opt.label}</span>
                  {isSelected ? (
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-shalean-primary" aria-hidden />
                  ) : (
                    <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  )}
                </li>
              );
            })
          )}
        </ul>
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        title={displayLabel}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`${triggerBaseClass} ${iconLeft ? "pl-12" : ""} ${open ? "border-shalean-primary/80 ring-[3px] ring-shalean-primary/10" : ""}`}
      >
        {iconLeft ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {iconLeft}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-normal sm:max-w-none">
          {displayLabel}
        </span>
        <IconChevron
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {portalReady && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
    </div>
  );
}
