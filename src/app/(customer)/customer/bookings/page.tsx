import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CustomerBookingsListContent } from "@/components/dashboard/customer/CustomerBookingsListContent";
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
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      {result && !result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "customer")}
          description={result.message}
        />
      ) : result?.ok ? (
        <CustomerBookingsListContent bookings={allBookings} />
      ) : null}
    </DashboardShell>
  );
}
