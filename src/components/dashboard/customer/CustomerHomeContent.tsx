import { CustomerHomeHero } from "@/components/dashboard/customer/CustomerHomeHero";
import { CustomerHomeLifecycleProgress } from "@/components/dashboard/customer/CustomerHomeLifecycleProgress";
import { CustomerHomeQuickActions } from "@/components/dashboard/customer/CustomerHomeQuickActions";
import { CustomerHomeRecentActivity } from "@/components/dashboard/customer/CustomerHomeRecentActivity";
import { CustomerHomeRecurringCta } from "@/components/dashboard/customer/CustomerHomeRecurringCta";
import { CustomerHomeUpcomingCard } from "@/components/dashboard/customer/CustomerHomeUpcomingCard";
import {
  customerHomeDisplayName,
  customerHomeShowsRecurringCta,
  pickFeaturedUpcomingBooking,
} from "@/features/dashboards/customerHomeDisplay";
import {
  customerHubHeroCopy,
  customerHubRecentStays,
  customerHubRebookHref,
  pickAlsoScheduledUpcoming,
} from "@/features/dashboards/customerHubDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

type Props = {
  bookings: CustomerBookingListItem[];
  profileFullName: string | null;
  customerEmail: string;
};

function hubQuickActions(featured: CustomerBookingListItem | null) {
  const detailHref = featured ? `/customer/bookings/${featured.id}` : "/customer/bookings";
  const rebookHref = customerHubRebookHref(featured?.display.serviceSlug ?? null);

  return [
    { label: "Reschedule", href: detailHref, icon: "calendar" as const },
    { label: "Message support", href: detailHref, icon: "message" as const },
    { label: "Rebook", href: rebookHref, icon: "refresh" as const },
    { label: "Cancel visit", href: detailHref, icon: "cancel" as const },
  ];
}

export function CustomerHomeContent({
  bookings,
  profileFullName,
  customerEmail,
}: Props) {
  const featured = pickFeaturedUpcomingBooking(bookings);
  const alsoScheduled = pickAlsoScheduledUpcoming(bookings, featured?.id ?? null);
  const displayName = customerHomeDisplayName(profileFullName, customerEmail);
  const heroCopy = customerHubHeroCopy({
    displayName,
    hasUpcoming: Boolean(featured),
  });
  const recentStays = customerHubRecentStays(bookings);
  const showRecurringCta = customerHomeShowsRecurringCta(bookings);

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <CustomerHomeHero copy={heroCopy} featured={featured} />
      <CustomerHomeUpcomingCard featured={featured} alsoScheduled={alsoScheduled} />
      {featured ? (
        <CustomerHomeLifecycleProgress
          status={featured.status}
          bookingDetailHref={`/customer/bookings/${featured.id}`}
        />
      ) : null}
      <CustomerHomeQuickActions actions={hubQuickActions(featured)} />
      <CustomerHomeRecentActivity stays={recentStays} />
      {showRecurringCta ? <CustomerHomeRecurringCta /> : null}
    </div>
  );
}
