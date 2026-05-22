import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import {
  getAdminNotificationHealthPage,
  parseNotificationHealthFilters,
} from "@/features/notifications/server/notificationAdminReadModel";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminNotificationAnalyticsPanel } from "@/components/dashboard/AdminNotificationAnalyticsPanel";
import { AdminNotificationDeliveryBanner } from "@/components/dashboard/AdminNotificationDeliveryBanner";
import { AdminNotificationTemplateBreakdownTable } from "@/components/dashboard/AdminNotificationTemplateBreakdownTable";
import { AdminNotificationWorkerHealthCard } from "@/components/dashboard/AdminNotificationWorkerHealthCard";
import { AdminNotificationRecentWorkerRunsTable } from "@/components/dashboard/AdminNotificationRecentWorkerRunsTable";
import { AdminNotificationHealthCards } from "@/components/dashboard/AdminNotificationHealthCards";
import { AdminNotificationFilters } from "@/components/dashboard/AdminNotificationFilters";
import { AdminNotificationOutboxTable } from "@/components/dashboard/AdminNotificationOutboxTable";
import { AdminNotificationRetentionDryRunPanel } from "@/components/dashboard/AdminNotificationRetentionDryRunPanel";
import { ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT } from "@/features/notifications/server/notificationAdminTypes";

export const metadata: Metadata = {
  title: "Notifications | Admin",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminNotificationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const filters = parseNotificationHealthFilters(params);
  const result = await getAdminNotificationHealthPage(user, filters);

  if (!result.ok) {
    if (result.status === 403) redirect("/");
    return (
      <AdminDashboardShell title="Notifications" subtitle="Queue health" nav={[...ADMIN_DASHBOARD_NAV]}>
        <p className="text-sm text-red-700">{result.message}</p>
      </AdminDashboardShell>
    );
  }

  const { page } = result;

  return (
    <AdminDashboardShell
      title="Notification delivery"
      subtitle="Queue health across all bookings. Requeue eligible failed rows. does not send email immediately."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminNotificationDeliveryBanner banner={page.banner} />
      <AdminNotificationAnalyticsPanel analytics={page.analytics} />
      <AdminNotificationTemplateBreakdownTable analytics={page.analytics} />
      <AdminNotificationWorkerHealthCard workerHealth={page.workerHealth} />
      <AdminNotificationRecentWorkerRunsTable runs={page.recentWorkerRuns} />
      <AdminNotificationRetentionDryRunPanel retention={page.retentionDryRun} />

      <section className="mt-6">
        <AdminNotificationHealthCards
          summary={page.summary}
          oldestActionablePendingAgeMs={page.oldestActionablePendingAgeMs}
        />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Queue rows</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Unsupported pending templates are counted separately and are not shown as delivery
          failures. Recipient emails are never displayed.
        </p>
        <div className="mt-4">
          <AdminNotificationFilters filters={page.filters} />
        </div>
        <AdminNotificationOutboxTable
          notifications={page.rows}
          showBookingLink
          showRequeueActions
          emptyMessage="No rows match the current filters."
        />
        <p className="mt-3 text-xs text-zinc-500">
          Showing up to {ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT} newest rows. Refine filters or use
          SQL for larger exports.
        </p>
      </section>
    </AdminDashboardShell>
  );
}
