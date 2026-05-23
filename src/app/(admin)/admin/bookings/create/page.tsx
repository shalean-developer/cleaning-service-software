import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AdminBookingWizard } from "@/features/admin-booking-wizard/components/AdminBookingWizard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import { isAdminAssistedOfflinePaymentsActive } from "@/lib/app/adminAssistedOfflinePaymentsFlag";
import { isZohoMonthlyAccountBillingEnabled } from "@/lib/app/zohoMonthlyAccountBillingFlag";
import { isZohoMonthlyServiceAuthorizationEnabled } from "@/lib/app/zohoMonthlyServiceAuthorizationFlag";
import { isAdminAssistedBookingPilotMode } from "@/lib/app/adminAssistedBookingPilotFlag";
import { resolveAdminAssistedBookingRolloutStage } from "@/lib/app/resolveAdminAssistedBookingRolloutStage";

export const metadata: Metadata = {
  title: "Create booking | Admin",
  description: "Admin-assisted booking wizard — draft creation",
};

type PageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

export default async function AdminBookingsCreatePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const featureEnabled = isAdminAssistedBookingEnabled();
  const paymentLinksEnabled = isAdminAssistedPaymentLinksActive();
  const offlinePaymentsEnabled = isAdminAssistedOfflinePaymentsActive();
  const monthlyBillingEnabled = isZohoMonthlyAccountBillingEnabled();
  const monthlyServiceAuthorizationEnabled = isZohoMonthlyServiceAuthorizationEnabled();
  const pilotMode = isAdminAssistedBookingPilotMode();
  const rolloutStage = resolveAdminAssistedBookingRolloutStage();
  const { customerId } = await searchParams;

  return (
    <AdminDashboardShell
      title="Create booking for customer"
      subtitle={
        featureEnabled
          ? "Admin-assisted booking — draft creation enabled (no payment or assignment)."
          : "Admin-assisted booking — preview only. Enable ADMIN_ASSISTED_BOOKING_ENABLED to save drafts."
      }
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminBookingWizard
        featureEnabled={featureEnabled}
        paymentLinksEnabled={paymentLinksEnabled}
        offlinePaymentsEnabled={offlinePaymentsEnabled}
        monthlyBillingEnabled={monthlyBillingEnabled}
        monthlyServiceAuthorizationEnabled={monthlyServiceAuthorizationEnabled}
        pilotMode={pilotMode}
        rolloutStage={rolloutStage}
        initialCustomerId={customerId ?? null}
      />
    </AdminDashboardShell>
  );
}
