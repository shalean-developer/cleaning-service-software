import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminBookingRecurringVerification } from "@/features/bookings/server/admin/loadAdminBookingRecurringVerification";

type Props = {
  verification: AdminBookingRecurringVerification;
};

function VerificationRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
}) {
  if (value == null || value === "") return null;
  return (
    <div
      className="flex flex-col gap-0.5 sm:flex-row sm:gap-3"
      data-testid={testId}
    >
      <dt className="min-w-[10rem] text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

export function AdminBookingRecurringVerificationPanel({ verification }: Props) {
  const { schedule } = verification;

  if (!schedule.recurringEnabled) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm"
      data-testid="admin-booking-recurring-verification-panel"
    >
      <h2 className="text-base font-semibold text-sky-950">Recurring verification</h2>
      <p className="mt-1 text-sm text-sky-900/80">
        Read-only schedule and materialization status for operator QA.
      </p>

      <dl className="mt-4 space-y-2">
        <VerificationRow label="Recurring enabled" value="Yes" testId="admin-booking-recurring-enabled" />
        <VerificationRow
          label="Schedule summary"
          value={schedule.scheduleSummaryLabel}
          testId="admin-booking-recurring-summary"
        />
        <VerificationRow label="Cadence" value={schedule.cadenceLabel} />
        <VerificationRow label="Selected days" value={schedule.selectedDaysLabel} />
        <VerificationRow
          label="Interval"
          value={
            schedule.intervalWeeks != null
              ? `Every ${schedule.intervalWeeks} week${schedule.intervalWeeks === 1 ? "" : "s"}`
              : null
          }
        />
        <VerificationRow
          label="Materialization"
          value={verification.materializationStatusLabel}
          testId="admin-booking-recurring-materialization-status"
        />
        {verification.groupId ? (
          <VerificationRow
            label="Schedule group"
            value={
              verification.groupHref ? (
                <Link
                  href={verification.groupHref}
                  className="font-medium text-sky-800 underline-offset-2 hover:underline"
                >
                  {verification.groupId}
                </Link>
              ) : (
                verification.groupId
              )
            }
            testId="admin-booking-recurring-group-id"
          />
        ) : null}
        {verification.primarySeriesId ? (
          <VerificationRow label="Primary series" value={verification.primarySeriesId} />
        ) : null}
        <VerificationRow
          label="Generation status"
          value={
            verification.materializationStatus === "succeeded"
              ? `${verification.generatedOccurrenceCount} generated occurrence(s)`
              : verification.materializationStatus === "pending_materialization"
                ? "Not materialized yet"
                : "Awaiting payment"
          }
          testId="admin-booking-recurring-generation-status"
        />
        <VerificationRow
          label="Next occurrence"
          value={verification.nextOccurrencePreview}
          testId="admin-booking-recurring-next-occurrence"
        />
        <VerificationRow
          label="Latest generated"
          value={
            verification.latestGeneratedOccurrenceAt
              ? new Date(verification.latestGeneratedOccurrenceAt).toLocaleString("en-ZA")
              : null
          }
        />
      </dl>

      <details className="mt-4 text-xs text-sky-900/70">
        <summary className="cursor-pointer font-medium text-sky-950">Materialization diagnostics</summary>
        <dl className="mt-2 space-y-1">
          <VerificationRow
            label="Booking series link"
            value={verification.diagnostics.seriesLinkedToBooking ? "Linked" : "Not linked"}
          />
          <VerificationRow
            label="Group linked"
            value={verification.diagnostics.groupLinked ? "Yes" : "No"}
          />
          <VerificationRow label="Series count" value={String(verification.seriesIds.length)} />
          <VerificationRow
            label="Occurrence count"
            value={String(verification.generatedOccurrenceCount)}
          />
        </dl>
      </details>
    </section>
  );
}
