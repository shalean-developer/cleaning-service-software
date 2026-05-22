import type { Metadata } from "next";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { CustomerHomeContent } from "@/components/dashboard/customer/CustomerHomeContent";
import { CustomerHubShell } from "@/components/dashboard/customer/CustomerHubShell";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { pickFeaturedUpcomingBooking } from "@/features/dashboards/customerHomeDisplay";
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

  const accountLabel =
    profileFullName?.trim() || customerEmail.split("@")[0] || "Your account";

  return (
    <CustomerHubShell
      accountLabel={accountLabel}
      showLiveBadge={Boolean(featured)}
      footerSlot={<CustomerDashboardHeaderEndLoader />}
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
        />
      ) : null}
    </CustomerHubShell>
  );
}
