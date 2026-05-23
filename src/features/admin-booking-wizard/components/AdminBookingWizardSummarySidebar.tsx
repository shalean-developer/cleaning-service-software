import type { AdminBookingWizardSummary } from "../types";
import {
  WIZARD_TEXT_MUTED,
  WIZARD_TEXT_PRIMARY,
} from "@/features/booking-wizard/wizardTheme";

type Props = {
  summary: AdminBookingWizardSummary;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0">
      <dt className={`text-[11px] font-medium uppercase tracking-wide ${WIZARD_TEXT_MUTED}`}>
        {label}
      </dt>
      <dd className={`text-sm ${WIZARD_TEXT_PRIMARY}`}>{value}</dd>
    </div>
  );
}

export function AdminBookingWizardSummarySidebar({ summary }: Props) {
  return (
    <aside
      className="hidden w-full shrink-0 md:block md:w-72 lg:w-80"
      aria-label="Booking summary"
      data-testid="admin-booking-summary-sidebar"
    >
      <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className={`text-sm font-semibold ${WIZARD_TEXT_PRIMARY}`}>Booking summary</h2>
        <p className={`mt-0.5 text-xs ${WIZARD_TEXT_MUTED}`}>Live preview — save on confirmation</p>
        <dl className="mt-3">
          <SummaryRow label="Customer" value={summary.customerLabel} />
          <SummaryRow label="Service" value={summary.serviceLabel} />
          <SummaryRow label="Frequency" value={summary.frequencyLabel} />
          {summary.recurringScheduleLabel !== "—" ? (
            <SummaryRow label="Recurring" value={summary.recurringScheduleLabel} />
          ) : null}
          <SummaryRow label="Extras" value={summary.extrasLabel} />
          <SummaryRow label="Schedule" value={summary.scheduleLabel} />
          <SummaryRow label="Address" value={summary.addressLabel} />
          <SummaryRow label="Access notes" value={summary.accessNotesLabel} />
          <SummaryRow label="Special instructions" value={summary.specialInstructionsLabel} />
          <SummaryRow label="Total (preview)" value={summary.totalLabel} />
          <SummaryRow label="Payment" value={summary.paymentLabel} />
        </dl>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Lifecycle
          </p>
          <p className="mt-1 text-xs text-slate-700">{summary.lifecyclePreview}</p>
        </div>
      </div>
    </aside>
  );
}

export function AdminBookingWizardSummaryMobileSheet({ summary }: Props) {
  return (
    <div
      className="mb-3 rounded-xl border border-slate-200 bg-white p-3 md:hidden"
      aria-label="Booking summary"
      data-testid="admin-booking-summary-mobile"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${WIZARD_TEXT_PRIMARY}`}>Summary</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {summary.totalLabel}
        </span>
      </div>
      <p className={`mt-1 truncate text-xs ${WIZARD_TEXT_MUTED}`}>
        {summary.customerLabel} · {summary.serviceLabel}
      </p>
      <p className="mt-1 truncate text-xs text-slate-600">{summary.extrasLabel}</p>
      <p className="mt-1 text-[10px] text-slate-500">{summary.lifecyclePreview}</p>
    </div>
  );
}
