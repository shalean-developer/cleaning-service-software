import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import {
  ADMIN_DETAIL_STACK_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { AdminCleanerAuditLog } from "@/components/dashboard/admin/AdminCleanerAuditLog";
import { AdminCleanerLifecycleActions } from "@/components/dashboard/admin/AdminCleanerLifecycleActions";
import { AdminCleanerProfileForm } from "@/components/dashboard/admin/AdminCleanerProfileForm";
import { getAdminCleanerDetail } from "@/features/cleaners/server/admin/adminCleanersReadModel";
import {
  labelForCleanerOperationalState,
  toneForCleanerOperationalState,
} from "@/features/cleaners/server/admin/adminCleanerOperationalDisplay";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

type PageProps = {
  params: Promise<{ cleanerId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cleanerId } = await params;
  return { title: `Cleaner ${cleanerId.slice(0, 8)} | Admin` };
}

export default async function AdminCleanerDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { cleanerId } = await params;
  const result = await getAdminCleanerDetail(user, cleanerId);

  if (!result.ok) {
    if (result.code === "CLEANER_NOT_FOUND") notFound();
    return (
      <AdminDashboardShell title="Cleaner" nav={[...ADMIN_DASHBOARD_NAV]}>
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      </AdminDashboardShell>
    );
  }

  const detail = result.detail;

  return (
    <AdminDashboardShell
      title={detail.name}
      subtitle="Cleaner operational lifecycle"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <p className="text-sm">
        <Link href="/admin/cleaners" className="text-zinc-600 underline-offset-2 hover:underline">
          ← All cleaners
        </Link>
      </p>

      <div className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminDetailSection title="Operational state" tone="ops">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              label={labelForCleanerOperationalState(detail.operationalState)}
              tone={toneForCleanerOperationalState(detail.operationalState)}
            />
            <span className="text-sm text-zinc-600">
              Active: {detail.active ? "yes" : "no"}
              {detail.suspendedAt ? " · Suspended" : ""}
              {detail.deletedAt ? " · Archived" : ""}
            </span>
          </div>
          {detail.lifecycleReason ? (
            <p className={`${ADMIN_SECTION_MUTED_CLASS} mt-2`}>
              Last documented reason: {detail.lifecycleReason}
            </p>
          ) : null}
        </AdminDetailSection>

        <AdminDetailSection
          title="Edit profile"
          description="Name, capabilities, and service areas. Phone and lifecycle are read-only here."
        >
          <AdminCleanerProfileForm
            cleanerId={detail.id}
            initialFullName={detail.name}
            initialCapabilities={detail.capabilities}
            initialServiceAreaSlugs={detail.serviceAreaSlugs}
            initialAvailability={detail.availability}
            readOnlyPhone={detail.phone}
            readOnlyLoginEmail={detail.loginEmail}
          />
        </AdminDetailSection>

        <AdminDetailSection title="Profile summary">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Auth email (resolved)
              </dt>
              <dd className="mt-0.5 text-zinc-900">{detail.email ?? detail.loginEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Onboarding completed
              </dt>
              <dd className="mt-0.5 text-zinc-900">
                {detail.onboardingCompletedAt
                  ? new Date(detail.onboardingCompletedAt).toLocaleString()
                  : "Not completed"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Working hours
              </dt>
              <dd className="mt-0.5 text-zinc-900">{detail.availabilitySummary}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rating</dt>
              <dd className="mt-0.5 text-zinc-900">
                {detail.averageRating != null ? detail.averageRating.toFixed(1) : "—"}
              </dd>
            </div>
          </dl>
        </AdminDetailSection>

        <AdminDetailSection
          title="Safety counts"
          description="Open offers, active bookings, and pending earnings before lifecycle actions."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className={ADMIN_SECTION_TITLE_CLASS}>Open offers</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {detail.safetyCounts.openOffersCount}
              </dd>
            </div>
            <div>
              <dt className={ADMIN_SECTION_TITLE_CLASS}>Active bookings</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {detail.safetyCounts.activeBookingsCount}
              </dd>
            </div>
            <div>
              <dt className={ADMIN_SECTION_TITLE_CLASS}>Pending earnings</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {detail.safetyCounts.pendingEarningsCount}
              </dd>
            </div>
          </dl>
        </AdminDetailSection>

        <AdminDetailSection
          title="Lifecycle actions"
          description="All changes run through audited service commands — lifecycle columns are not edited from the UI."
          tone="ops"
        >
          <AdminCleanerLifecycleActions
            cleanerId={detail.id}
            operationalState={detail.operationalState}
            safetyCounts={detail.safetyCounts}
          />
        </AdminDetailSection>

        <AdminDetailSection title="Audit log" collapsible defaultOpen>
          <AdminCleanerAuditLog entries={detail.auditLog} />
        </AdminDetailSection>

        {detail.openOffers.length > 0 || detail.activeBookingIds.length > 0 ? (
          <AdminDetailSection title="Linked activity" collapsible>
            {detail.openOffers.length > 0 ? (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Open offers
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.openOffers.map((offer) => (
                    <li key={offer.id}>
                      <Link
                        href={`/admin/bookings/${offer.booking_id}`}
                        className="text-zinc-800 underline-offset-2 hover:underline"
                      >
                        Booking {offer.booking_id.slice(0, 8)} — offered
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.activeBookingIds.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Active bookings
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.activeBookingIds.map((bookingId) => (
                    <li key={bookingId}>
                      <Link
                        href={`/admin/bookings/${bookingId}`}
                        className="text-zinc-800 underline-offset-2 hover:underline"
                      >
                        Booking {bookingId.slice(0, 8)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </AdminDetailSection>
        ) : null}
      </div>
    </AdminDashboardShell>
  );
}
