import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CustomerBookingsListContent } from "@/components/dashboard/customer/CustomerBookingsListContent";
import { CustomerBookingsPageHeader } from "@/components/dashboard/customer/CustomerBookingsPageHeader";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "My bookings | Customer",
};

export default async function CustomerBookingsPage() {
  const user = await getCurrentUser();
  const result = user ? await listCustomerBookings(user) : null;
  const allBookings = result?.ok ? result.bookings : [];

  return (
    <DashboardShell
      title="My bookings"
      subtitle="Your cleans, payments, and cleaner assignment status."
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      {result && !result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "customer")}
          description={result.message}
        />
      ) : result?.ok ? (
        <section className="space-y-6 sm:space-y-8">
          <CustomerBookingsPageHeader />
          <CustomerBookingsListContent bookings={allBookings} />
        </section>
      ) : null}
    </DashboardShell>
  );
}
