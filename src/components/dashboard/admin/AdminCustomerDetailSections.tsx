import Link from "next/link";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { AdminCustomerDomainHealthBadge } from "@/components/dashboard/admin/AdminCustomerDomainHealthBadge";
import { AdminCustomerBookingCard } from "@/components/dashboard/admin/AdminCustomerBookingCard";
import { AdminCustomerBookingFilters } from "@/components/dashboard/admin/AdminCustomerBookingFilters";
import { formatAdminCustomerLastActivity } from "@/features/customers/server/admin/adminCustomersListDisplay";
import {
  ADMIN_CUSTOMER_ASSISTED_BOOKING_LABEL,
  ADMIN_CUSTOMER_ASSISTED_BOOKING_PREVIEW_HELPER,
  buildAdminBookingCreateHref,
} from "@/features/customers/server/admin/adminCustomerBookingAssist";
import {
  adminCustomerBookingFilterEmptyMessage,
  filterAdminCustomerBookings,
} from "@/features/customers/server/admin/adminCustomerBookingOperations";
import type { AdminCustomerDetailBookingFilter } from "@/features/customers/server/admin/parseAdminCustomerDetailQuery";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";
import { labelForPaymentStatus } from "@/features/bookings/server/statusLabels";
import { AdminCustomerActivityTimeline } from "@/components/dashboard/admin/AdminCustomerActivityTimeline";
import type { CustomerOperationalTimelineEvent } from "@/features/customers/server/admin/customerOperationalTimelineTypes";
import type {
  AdminCustomerDetail,
  AdminCustomerPaymentSupportSummary,
} from "@/features/customers/server/admin/types";

type Props = {
  detail: AdminCustomerDetail;
  timeline: CustomerOperationalTimelineEvent[];
  timelineError?: string | null;
  bookingFilter: AdminCustomerDetailBookingFilter;
  draftBookingEnabled?: boolean;
};

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function computeDetailLastActivity(detail: AdminCustomerDetail): string {
  const updatedMs = new Date(detail.customerUpdatedAt).getTime();
  const bookingMs = detail.latestBooking
    ? new Date(detail.latestBooking.createdAt).getTime()
    : 0;
  return new Date(Math.max(updatedMs, bookingMs)).toISOString();
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function OpsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function LatestPaymentStatusCell({
  paymentSupport,
}: {
  paymentSupport: AdminCustomerPaymentSupportSummary;
}) {
  const statusLabel = paymentSupport.latestPaymentStatus
    ? labelForPaymentStatus(paymentSupport.latestPaymentStatus)
    : "\u2014";
  const bookingId = paymentSupport.latestPaymentBookingId;

  if (!bookingId) {
    return <>{statusLabel}</>;
  }

  return (
    <>
      {statusLabel}
      <span className="text-zinc-700">
        {" \u00b7 "}
        <Link
          href={`/admin/bookings/${bookingId}`}
          className="underline-offset-2 hover:underline"
        >
          Booking {bookingId.slice(0, 8)}
        </Link>
      </span>
    </>
  );
}

export function AdminCustomerDetailSections({
  detail,
  timeline,
  timelineError,
  bookingFilter,
  draftBookingEnabled = false,
}: Props) {
  const { paymentSummary, lifecycleSummary, bookingOperations, paymentSupport } = detail;
  const pendingFailed = paymentSummary.pendingCount + paymentSummary.failedCount;
  const lastActivityAt = computeDetailLastActivity(detail);
  const filteredBookings = filterAdminCustomerBookings(detail.bookings, bookingFilter);
  const emptyMessage = adminCustomerBookingFilterEmptyMessage(bookingFilter);

  return (
    <>
      <section aria-label="Customer summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total bookings" value={String(lifecycleSummary.totalBookings)} />
          <SummaryCard
            label="Paid payments"
            value={String(paymentSummary.paidCount)}
            hint={formatZar(paymentSummary.totalPaidCents)}
          />
          <SummaryCard
            label="Pending / failed"
            value={String(pendingFailed)}
            hint={`${paymentSummary.pendingCount} pending · ${paymentSummary.failedCount} failed`}
          />
          <SummaryCard
            label="Last activity"
            value={formatAdminCustomerLastActivity(lastActivityAt)}
          />
        </div>
      </section>

      <AdminDetailSection
        title="Customer booking operations"
        description="Read-only booking shortcuts and counts (customer_id ownership)."
        defaultOpen
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Link
              href={buildAdminBookingCreateHref(detail.customerId)}
              className={
                draftBookingEnabled
                  ? "inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  : "inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              }
              data-testid="admin-customer-create-draft-booking"
            >
              {ADMIN_CUSTOMER_ASSISTED_BOOKING_LABEL}
            </Link>
            {!draftBookingEnabled ? (
              <p className="text-xs text-zinc-500">{ADMIN_CUSTOMER_ASSISTED_BOOKING_PREVIEW_HELPER}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <OpsMetric label="Active bookings" value={String(bookingOperations.activeCount)} />
          <OpsMetric label="Upcoming" value={String(bookingOperations.upcomingCount)} />
          <OpsMetric
            label="Pending payment"
            value={String(bookingOperations.pendingPaymentCount)}
          />
          <OpsMetric
            label="Failed payment"
            value={String(bookingOperations.failedPaymentCount)}
          />
          <OpsMetric label="Completed" value={String(bookingOperations.completedCount)} />
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Latest booking</dt>
            <dd>
              {bookingOperations.latestBookingId ? (
                <Link
                  href={`/admin/bookings/${bookingOperations.latestBookingId}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {bookingOperations.latestBookingId.slice(0, 8)}…
                </Link>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next scheduled</dt>
            <dd>
              {bookingOperations.nextScheduledBookingId ? (
                <Link
                  href={`/admin/bookings/${bookingOperations.nextScheduledBookingId}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {bookingOperations.nextScheduledBookingId.slice(0, 8)}…
                </Link>
              ) : (
                "-"
              )}
            </dd>
          </div>
        </dl>
      </AdminDetailSection>

      <AdminDetailSection
        title="Payment support summary"
        description="Read-only payment visibility for support triage."
        collapsible
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Total paid</dt>
            <dd className="font-medium text-zinc-900">
              {formatZar(paymentSupport.totalPaidCents)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Pending payments</dt>
            <dd>{paymentSupport.pendingPaymentCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Failed payments</dt>
            <dd>{paymentSupport.failedPaymentCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Latest payment attempt</dt>
            <dd>
              {paymentSupport.latestPaymentAttemptAt
                ? formatDateTime(paymentSupport.latestPaymentAttemptAt)
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Payment method</dt>
            <dd>{paymentSupport.latestPaymentMethod ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Latest payment status</dt>
            <dd>
              <LatestPaymentStatusCell paymentSupport={paymentSupport} />
            </dd>
          </div>
        </dl>
      </AdminDetailSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminDetailSection title="Contact" tone="ops">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Auth email</dt>
              <dd className="font-medium text-zinc-900">{detail.authEmail ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Phone</dt>
              <dd className="text-zinc-900">{detail.phone ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Company</dt>
              <dd className="text-zinc-900">{detail.companyName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Notes</dt>
              <dd className="whitespace-pre-wrap text-zinc-800">
                {detail.notes?.trim() ? detail.notes : "No operational notes on file."}
              </dd>
            </div>
          </dl>
        </AdminDetailSection>

        <AdminDetailSection title="Domain health" tone="ops">
          <AdminCustomerDomainHealthBadge
            health={detail.domainHealth}
            provisioningHealthy={detail.provisioningHealthy}
            showDetail
          />
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Profile role</dt>
              <dd className="text-zinc-900">{detail.profileRole ?? "- (orphan profile)"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Customer row</dt>
              <dd className="text-zinc-900">
                Present · updated {formatDateTime(detail.customerUpdatedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Dual-domain status</dt>
              <dd className="text-zinc-900">
                {detail.hasCleanersRow
                  ? "Also has cleaners row (dual domain)"
                  : "Customer profile only"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Provisioning</dt>
              <dd className="text-zinc-900">
                {detail.provisioningHealthy ? "Healthy" : "Needs attention"}
              </dd>
            </div>
          </dl>
        </AdminDetailSection>
      </div>

      <AdminDetailSection
        title="Lifecycle summary"
        description="Booking counts by lifecycle state (canonical customer_id ownership)."
        collapsible
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Draft</dt>
            <dd>{lifecycleSummary.draftCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Active pipeline</dt>
            <dd>{lifecycleSummary.confirmedCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Completed</dt>
            <dd>{lifecycleSummary.completedCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Cancelled</dt>
            <dd>{lifecycleSummary.cancelledCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Other</dt>
            <dd>{lifecycleSummary.otherCount}</dd>
          </div>
        </dl>
      </AdminDetailSection>

      <AdminDetailSection
        title="Bookings history"
        description={`${filteredBookings.length} of ${detail.bookingCount} booking(s) shown.`}
        collapsible
        defaultOpen
      >
        <div className="mb-4">
          <AdminCustomerBookingFilters
            customerId={detail.customerId}
            activeFilter={bookingFilter}
          />
        </div>
        {filteredBookings.length === 0 ? (
          <p className={ADMIN_SECTION_MUTED_CLASS}>{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {filteredBookings.map((booking) => (
              <AdminCustomerBookingCard key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </AdminDetailSection>

      <AdminDetailSection
        title="Series-linked bookings"
        description={`${detail.recurringCount} booking(s) linked to a series.`}
        collapsible
      >
        {detail.recurringBookings.length === 0 ? (
          <p className={ADMIN_SECTION_MUTED_CLASS}>No series-linked bookings.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {detail.recurringBookings.map((booking) => (
              <li key={booking.id} className="px-3 py-3 text-sm">
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {booking.bookingReference}
                </Link>
                <p className="text-zinc-600">
                  {booking.frequencyLabel ?? "Series"}
                  {booking.seriesId ? ` · series ${booking.seriesId.slice(0, 8)}…` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminDetailSection>

      <AdminDetailSection title="Payment history" collapsible>
        {detail.payments.length === 0 ? (
          <p className={ADMIN_SECTION_MUTED_CLASS}>No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {detail.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">{payment.status}</p>
                  <p className="text-zinc-600">
                    Booking{" "}
                    <Link
                      href={`/admin/bookings/${payment.bookingId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {payment.bookingId.slice(0, 8)}…
                    </Link>
                    {" · "}
                    {payment.provider}
                  </p>
                </div>
                <p className="text-zinc-700">
                  {formatZar(payment.amountCents)} · {formatDateTime(payment.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminDetailSection>

      <AdminDetailSection
        title="Customer activity timeline"
        description="Recent customer, booking, and payment events (newest first, max 20)."
        collapsible
        defaultOpen
      >
        {timelineError ? (
          <p className={ADMIN_SECTION_MUTED_CLASS}>{timelineError}</p>
        ) : (
          <AdminCustomerActivityTimeline events={timeline} />
        )}
      </AdminDetailSection>
    </>
  );
}
