import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CustomerBookingsDashboard } from "@/components/dashboard/customer/CustomerBookingsDashboard";
import { CustomerBookingsEmptyState } from "@/components/dashboard/customer/CustomerBookingsEmptyState";
import { CustomerBookingsPageHeader } from "@/components/dashboard/customer/CustomerBookingsPageHeader";

export const metadata: Metadata = {
  title: "My Bookings | Customer",
};

export default async function CustomerHomePage() {
  const user = await getCurrentUser();
  const result = user ? await listCustomerBookings(user) : null;
  const allBookings = result?.ok ? result.bookings : [];

  return (
    <DashboardShell
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      {result && !result.ok ? (
        <DashboardFetchError
          title="Could not load your bookings"
          description={result.message}
        />
      ) : result?.ok ? (
        <section className="space-y-6 sm:space-y-8">
          <CustomerBookingsPageHeader />
          {allBookings.length === 0 ? (
            <CustomerBookingsEmptyState
              title="No bookings yet"
              description="Book your first clean and it will appear here once checkout is complete."
            />
          ) : (
            <CustomerBookingsDashboard bookings={allBookings} />
          )}
        </section>
      ) : null}
    </DashboardShell>
  );
}
