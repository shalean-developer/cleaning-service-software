"use client";

import {
  MAX_RECURRING_DAYS_PER_WEEK,
  MIN_RECURRING_DAYS_PER_WEEK,
  RECURRING_WEEKDAY_LABELS,
} from "@/features/recurring/recurringScheduleDays";
import { WIZARD_FOCUS_RING } from "../wizardSelection";

type Props = {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  error?: string;
};

const WEEKDAY_OPTIONS = RECURRING_WEEKDAY_LABELS.map((label, value) => ({ label, value }));

export function RecurringDaysSelector({ selectedDays, onChange, error }: Props) {
  const toggle = (day: number) => {
    const set = new Set(selectedDays);
    if (set.has(day)) {
      if (set.size <= MIN_RECURRING_DAYS_PER_WEEK) return;
      set.delete(day);
    } else {
      if (set.size >= MAX_RECURRING_DAYS_PER_WEEK) return;
      set.add(day);
    }
    onChange([...set].sort((a, b) => a - b));
  };

  return (
    <section className="mt-6 min-w-0" aria-labelledby="recurring-days-label">
      <h3 id="recurring-days-label" className="text-sm font-medium text-zinc-800">
        Preferred recurring days
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Choose which weekdays you want this service. One arrival time applies to all selected days.
      </p>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Preferred recurring weekdays"
      >
        {WEEKDAY_OPTIONS.map(({ label, value }) => {
          const selected = selectedDays.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(value)}
              className={`min-h-10 min-w-[3rem] rounded-full border px-3 text-sm font-medium transition-colors ${WIZARD_FOCUS_RING} ${
                selected
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
