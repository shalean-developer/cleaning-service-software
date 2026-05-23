"use client";

import { RecurringDaysSelector } from "@/features/booking-wizard/components/RecurringDaysSelector";
import {
  ADMIN_RECURRING_INTERVAL_MAX_WEEKS,
  ADMIN_RECURRING_INTERVAL_MIN_WEEKS,
  formatAdminRecurringScheduleSummary,
} from "../adminRecurringSchedule";
import type { AdminBookingWizardFormState } from "../draftFormState";

type Props = {
  form: AdminBookingWizardFormState;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
  validationError?: string | null;
};

export function AdminBookingWizardRecurringSchedulePanel({
  form,
  onFormChange,
  validationError,
}: Props) {
  const isCustom = form.frequency === "custom";
  const summary = formatAdminRecurringScheduleSummary({
    frequency: form.frequency,
    recurringDays: form.recurringDays,
    recurringIntervalWeeks: form.recurringIntervalWeeks,
    time: form.time,
  });

  return (
    <section
      className="mt-4 space-y-4 rounded-xl border border-sky-200 bg-sky-50/40 p-3"
      data-testid="admin-booking-recurring-schedule-panel"
    >
      <div>
        <h3 className="text-sm font-semibold text-sky-950">Recurring schedule</h3>
        <p className="mt-1 text-xs text-sky-900/80">
          Custom schedules are currently weekly-based (every 1 or 2 weeks). Assignment still occurs
          per visit after payment confirmation. Recurring visits inherit booking preferences.
        </p>
      </div>

      {isCustom ? (
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-600">Repeat every</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={ADMIN_RECURRING_INTERVAL_MIN_WEEKS}
              max={ADMIN_RECURRING_INTERVAL_MAX_WEEKS}
              step={1}
              value={form.recurringIntervalWeeks}
              onChange={(e) =>
                onFormChange({
                  recurringIntervalWeeks: Math.max(
                    ADMIN_RECURRING_INTERVAL_MIN_WEEKS,
                    Math.min(ADMIN_RECURRING_INTERVAL_MAX_WEEKS, Number(e.target.value) || 1),
                  ),
                })
              }
              className="w-20 min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              data-testid="admin-booking-recurring-interval-weeks"
            />
            <span className="text-sm text-slate-700">week(s)</span>
          </div>
        </label>
      ) : null}

      <RecurringDaysSelector
        selectedDays={form.recurringDays}
        onChange={(days) => onFormChange({ recurringDays: days })}
        error={validationError ?? undefined}
      />

      {summary ? (
        <p className="text-sm font-medium text-sky-950" data-testid="admin-booking-recurring-summary">
          {summary}
        </p>
      ) : null}
    </section>
  );
}
