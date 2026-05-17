import Link from "next/link";
import type { AdminOperationsSummary } from "@/features/dashboards/server/types";
import { ADMIN_HOME_PREVIEW_LIMIT } from "@/features/dashboards/server/adminOperationalHelpers";

type Props = {
  summary: AdminOperationsSummary;
};

export function AdminOpsSummaryCards({ summary }: Props) {
  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-3">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">Assignment attention</h2>
        <p className="mt-1 text-2xl font-semibold text-amber-950">
          {summary.assignmentAttentionTotal}
        </p>
        {summary.assignmentAttentionTotal > ADMIN_HOME_PREVIEW_LIMIT ? (
          <p className="text-xs text-amber-800">
            Home preview shows up to {ADMIN_HOME_PREVIEW_LIMIT}; see full queue.
          </p>
        ) : null}
        <Link
          href="/admin/assignments"
          className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline"
        >
          Open assignment queue →
        </Link>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-sm font-semibold text-red-900">Payment issues</h2>
        <p className="mt-1 text-2xl font-semibold text-red-950">{summary.paymentIssueTotal}</p>
        <Link
          href="/admin/bookings?filter=payment_failed"
          className="mt-3 inline-block text-sm font-medium text-red-900 hover:underline"
        >
          View payment failed →
        </Link>
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
        <h2 className="text-sm font-semibold text-violet-900">Recovery needed</h2>
        <p className="mt-1 text-2xl font-semibold text-violet-950">{summary.recoveryNeededTotal}</p>
        <Link
          href="/admin/bookings?filter=recovery_needed"
          className="mt-3 inline-block text-sm font-medium text-violet-900 hover:underline"
        >
          View recovery candidates →
        </Link>
      </section>
    </section>
  );
}
