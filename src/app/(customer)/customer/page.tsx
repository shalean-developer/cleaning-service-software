import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { CustomerHomeContent } from "@/components/dashboard/customer/CustomerHomeContent";
import {
  getCustomerBookingDetail,
  listCustomerBookings,
} from "@/features/dashboards/server/customerBookingReadModel";
import { pickFeaturedUpcomingBooking } from "@/features/dashboards/customerHomeDisplay";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home | Customer",
};

export default async function CustomerHomePage() {
  const user = await getCurrentUser();
  const result = user ? await listCustomerBookings(user) : null;
  const bookings = result?.ok ? result.bookings : [];

  let profileFullName: string | null = null;
  let customerEmail = "";

  if (user) {
    customerEmail = user.authUser.email?.trim() ?? "";
    const client = await createSupabaseServerClient();
    if (client) {
      const { data: profile } = await client
        .from("profiles")
        .select("full_name")
        .eq("id", user.profileId)
        .maybeSingle();
      profileFullName = profile?.full_name?.trim() ?? null;
    }
  }

  const featured = pickFeaturedUpcomingBooking(bookings);
  let featuredTimeline = null;
  if (user && featured) {
    const detail = await getCustomerBookingDetail(user, featured.id);
    if (detail.ok) {
      featuredTimeline = detail.booking.timeline;
    }
  }

  return (
    <DashboardShell
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      stickyHeader
      headerEnd={<CustomerDashboardHeaderEndLoader />}
      mainClassName="mx-auto min-w-0 max-w-5xl px-4 py-4 sm:py-5"
    >
      {result && !result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "customer")}
          description={result.message}
        />
      ) : result?.ok ? (
        <CustomerHomeContent
          bookings={bookings}
          profileFullName={profileFullName}
          customerEmail={customerEmail}
          featuredTimeline={featuredTimeline}
        />
      ) : null}
    </DashboardShell>
  );
}
