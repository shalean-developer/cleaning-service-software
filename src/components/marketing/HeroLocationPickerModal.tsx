"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterHeroLocationPickerAreas,
  getHeroLocationPickerDisplayLabel,
} from "@/features/locations/heroLocationPickerAreas";
import { IconClose, IconMapPin } from "./icons";

type HeroLocationPickerModalProps = {
  open: boolean;
  selectedAreaName: string | null;
  isDetecting: boolean;
  onClose: () => void;
  onSelectArea: (areaName: string) => void;
  onUseCurrentLocation: () => void;
};

export function HeroLocationPickerModal({
  open,
  selectedAreaName,
  isDetecting,
  onClose,
  onSelectArea,
  onUseCurrentLocation,
}: HeroLocationPickerModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");

  const filteredAreas = useMemo(() => filterHeroLocationPickerAreas(search), [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDetecting) onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isDetecting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-shalean-navy/25 backdrop-blur-[1px]"
        aria-label="Close location picker"
        onClick={() => !isDetecting && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex max-h-[min(88vh,40rem)] w-full flex-col rounded-t-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] sm:max-h-[min(80vh,36rem)] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0 pr-2">
            <h2
              id={titleId}
              className="text-lg font-bold tracking-tight text-shalean-navy sm:text-xl"
            >
              Choose your location
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-slate-600">
              Select the Cape Town area where you need cleaning.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={isDetecting}
            className="marketing-focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-shalean-navy disabled:opacity-60"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isDetecting}
            className="marketing-focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-shalean-primary/25 bg-shalean-soft-blue/50 px-4 py-3 text-sm font-semibold text-shalean-navy transition hover:border-shalean-primary/40 hover:bg-shalean-soft-blue/70 disabled:opacity-60"
          >
            <IconMapPin className="h-4 w-4 shrink-0 text-shalean-primary" aria-hidden />
            {isDetecting ? "Detecting location…" : "Use my current location"}
          </button>

          <div>
            <label htmlFor={searchId} className="sr-only">
              Search suburb
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search suburb"
              autoComplete="off"
              className="marketing-focus-ring h-11 w-full rounded-xl border border-slate-200/90 bg-white px-4 text-sm text-shalean-navy placeholder:text-slate-400"
            />
          </div>

          <ul
            className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto overscroll-contain pb-1 sm:grid-cols-2"
            role="listbox"
            aria-label="Cape Town service areas"
          >
            {filteredAreas.length === 0 ? (
              <li className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No suburbs match your search.
              </li>
            ) : (
              filteredAreas.map((areaName) => {
                const displayLabel = getHeroLocationPickerDisplayLabel(areaName);
                const isSelected =
                  selectedAreaName != null &&
                  selectedAreaName.toLowerCase() === areaName.toLowerCase();

                return (
                  <li key={areaName} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectArea(areaName)}
                      className={`marketing-focus-ring w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        isSelected
                          ? "border-shalean-primary bg-shalean-soft-blue/50 text-shalean-navy"
                          : "border-slate-200/90 bg-white text-shalean-navy hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {displayLabel}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
