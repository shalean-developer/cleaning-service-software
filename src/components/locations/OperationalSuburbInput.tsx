"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getCleanerAreaOptionGroups,
  getPopularOperationalAreas,
} from "@/features/locations/locationRegistry";
import {
  formatLocationName,
  isKnownOperationalArea,
  normalizeLocationInput,
  resolveOperationalLocation,
} from "@/features/locations/locationDisplay";
import { filterCleanerAreaOptionGroups } from "@/features/locations/operationalLocationSearch";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
};

export function OperationalSuburbInput({
  id,
  value,
  onChange,
  className,
  autoComplete = "address-level3",
  "aria-invalid": ariaInvalid,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const allGroups = useMemo(() => getCleanerAreaOptionGroups(), []);
  const popular = useMemo(() => getPopularOperationalAreas(), []);

  const filteredGroups = useMemo(
    () => filterCleanerAreaOptionGroups(allGroups, value),
    [allGroups, value],
  );

  const flatOptions = useMemo(
    () => filteredGroups.flatMap((g) => g.options),
    [filteredGroups],
  );

  const resolved = useMemo(() => resolveOperationalLocation(value), [value]);
  const showPopular = !value.trim();

  useEffect(() => {
    setActiveIndex(0);
  }, [value, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectOption(label: string) {
    onChange(label);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open || flatOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === "Enter" && flatOptions[activeIndex]) {
      e.preventDefault();
      selectOption(flatOptions[activeIndex]!.label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        placeholder="Search suburbs and areas…"
      />
      <p className="mt-1 text-xs text-zinc-500">
        Search 140+ Cape Town areas. Type an alias like &ldquo;Tableview&rdquo; or &ldquo;Bo Kaap&rdquo;.
      </p>
      {resolved && value.trim() ? (
        <p className="mt-1 text-xs font-medium text-emerald-700" role="status">
          Matched: {resolved.name}
          {resolved.region ? ` · ${resolved.region}` : null}
        </p>
      ) : value.trim() && !isKnownOperationalArea(value) ? (
        <p className="mt-1 text-xs text-zinc-600" role="status">
          We&apos;ll save &ldquo;{formatLocationName(value)}&rdquo; — can&apos;t find your area? Continue with
          your suburb name.
        </p>
      ) : null}

      {open && (flatOptions.length > 0 || showPopular) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {showPopular ? (
            <li className="px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Popular areas
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {popular.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    role="option"
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(opt.label)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </li>
          ) : null}

          {filteredGroups.map((group) => (
            <li key={group.region}>
              <p className="sticky top-0 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {group.region}
              </p>
              <ul>
                {group.options.map((opt) => {
                  const idx = flatOptions.findIndex((o) => o.slug === opt.slug);
                  const active = idx === activeIndex;
                  return (
                    <li key={opt.slug}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`w-full px-3 py-2 text-left text-sm ${
                          active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-800 hover:bg-zinc-50"
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectOption(opt.label)}
                      >
                        {opt.label}
                        {opt.isSeoLocation ? (
                          <span className="ml-1.5 text-xs text-zinc-500">· featured</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Normalize suburb on blur when a registry match exists (booking/checkout). */
export function normalizeSuburbOnBlur(value: string): string {
  return normalizeLocationInput(value);
}
