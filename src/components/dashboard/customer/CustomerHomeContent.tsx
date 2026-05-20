import { CustomerHomeHero } from "@/components/dashboard/customer/CustomerHomeHero";
import { CustomerHomeLifecycleProgress } from "@/components/dashboard/customer/CustomerHomeLifecycleProgress";
import { CustomerHomeQuickActions } from "@/components/dashboard/customer/CustomerHomeQuickActions";
import { CustomerHomeRecentActivity } from "@/components/dashboard/customer/CustomerHomeRecentActivity";
import { CustomerHomeRecurringCta } from "@/components/dashboard/customer/CustomerHomeRecurringCta";
import { CustomerHomeSummaryCards } from "@/components/dashboard/customer/CustomerHomeSummaryCards";
import { CustomerHomeUpcomingCard } from "@/components/dashboard/customer/CustomerHomeUpcomingCard";
import {
  customerHomeDisplayName,
  customerHomeHeroCopy,
  customerHomeRecentActivity,
  customerHomeShowsRecurringCta,
  customerHomeSummaryStats,
  pickFeaturedUpcomingBooking,
} from "@/features/dashboards/customerHomeDisplay";
import type { LifecycleEvent } from "@/features/dashboards/server/lifecycleTimeline";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

type Props = {
  bookings: CustomerBookingListItem[];
  profileFullName: string | null;
  customerEmail: string;
  featuredTimeline: LifecycleEvent[] | null;
};

export function CustomerHomeContent({
  bookings,
  profileFullName,
  customerEmail,
  featuredTimeline,
}: Props) {
  const featured = pickFeaturedUpcomingBooking(bookings);
  const displayName = customerHomeDisplayName(profileFullName, customerEmail);
  const heroCopy = customerHomeHeroCopy({ displayName, featured });
  const stats = customerHomeSummaryStats(bookings);
  const activity = customerHomeRecentActivity(bookings, featuredTimeline);
  const showRecurringCta = customerHomeShowsRecurringCta(bookings);

  return (
    <div className="space-y-4 sm:space-y-5">
      <CustomerHomeHero copy={heroCopy} />
      <CustomerHomeSummaryCards stats={stats} />
      <CustomerHomeUpcomingCard featured={featured} />
      {featured ? <CustomerHomeLifecycleProgress status={featured.status} /> : null}
      <CustomerHomeQuickActions />
      <CustomerHomeRecentActivity items={activity} />
      {showRecurringCta ? <CustomerHomeRecurringCta /> : null}
    </div>
  );
}
