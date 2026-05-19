"use client";

import {
  CLEANER_AVAILABILITY_DAY_OPTIONS,
  CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
  type CleanerAvailabilityFormErrors,
  type CleanerAvailabilityFormField,
  type CleanerAvailabilityFormValues,
} from "@/features/cleaners/admin/cleanerAvailability";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50";

const INPUT_ERROR_CLASS = "border-red-300 focus-visible:ring-red-600";

const FIELD_ERROR_CLASS = "mt-1 text-xs text-red-700";

type Props = {
  values: CleanerAvailabilityFormValues;
  onChange: (values: CleanerAvailabilityFormValues) => void;
  errors: CleanerAvailabilityFormErrors;
  touched: Partial<Record<CleanerAvailabilityFormField, boolean>>;
  submitAttempted: boolean;
  onTouch: (field: CleanerAvailabilityFormField) => void;
  disabled?: boolean;
};

function fieldClass(hasError: boolean): string {
  return hasError ? `${INPUT_CLASS} ${INPUT_ERROR_CLASS}` : INPUT_CLASS;
}

export function CleanerAvailabilityFields({
  values,
  onChange,
  errors,
  touched,
  submitAttempted,
  onTouch,
  disabled = false,
}: Props) {
  function showError(field: CleanerAvailabilityFormField): string | undefined {
    if (!submitAttempted && !touched[field]) return undefined;
    return errors[field];
  }

  function toggleDay(day: number) {
    const selected = values.workingDays.includes(day);
    onChange({
      ...values,
      workingDays: selected
        ? values.workingDays.filter((d) => d !== day)
        : [...values.workingDays, day].sort((a, b) => a - b),
    });
    onTouch("workingDays");
  }

  return (
    <fieldset className="text-sm" disabled={disabled}>
      <legend className="font-medium text-zinc-800">Available days & hours</legend>
      <p className="mt-0.5 text-xs text-zinc-500">
        Select available days. Default is Monday–Saturday, 07:00–18:00 (Sunday unavailable).
      </p>

      <div className="mt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Available days
        </span>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Available days">
          {CLEANER_AVAILABILITY_DAY_OPTIONS.map((day) => {
            const checked = values.workingDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={checked}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  checked
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
                onClick={() => toggleDay(day.value)}
                onBlur={() => onTouch("workingDays")}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {showError("workingDays") ? (
          <p className={FIELD_ERROR_CLASS}>{showError("workingDays")}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="font-medium text-zinc-800">Start time</span>
          <input
            type="time"
            className={fieldClass(Boolean(showError("startTime")))}
            value={values.startTime}
            onChange={(e) => onChange({ ...values, startTime: e.target.value })}
            onBlur={() => onTouch("startTime")}
          />
          {showError("startTime") ? (
            <p className={FIELD_ERROR_CLASS}>{showError("startTime")}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="font-medium text-zinc-800">End time</span>
          <input
            type="time"
            className={fieldClass(Boolean(showError("endTime")))}
            value={values.endTime}
            onChange={(e) => onChange({ ...values, endTime: e.target.value })}
            onBlur={() => onTouch("endTime")}
          />
          {showError("endTime") ? (
            <p className={FIELD_ERROR_CLASS}>{showError("endTime")}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="font-medium text-zinc-800">Timezone</span>
          <input
            type="text"
            className={fieldClass(Boolean(showError("timezone")))}
            value={values.timezone}
            onChange={(e) => onChange({ ...values, timezone: e.target.value })}
            onBlur={() => onTouch("timezone")}
            placeholder={CLEANER_AVAILABILITY_TIMEZONE_DEFAULT}
          />
          {showError("timezone") ? (
            <p className={FIELD_ERROR_CLASS}>{showError("timezone")}</p>
          ) : null}
        </label>
      </div>
    </fieldset>
  );
}
