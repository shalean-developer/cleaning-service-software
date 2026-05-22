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
import { customerHubSupportQuickLinks } from "@/features/bookings/server/bookingSupportRequestTypes";

type Props = {
  bookings: CustomerBookingListItem[];
  profileFullName: string | null;
  customerEmail: string;
};

function hubQuickActions(featured: CustomerBookingListItem | null) {
  const rebookHref = customerHubRebookHref(featured?.display.serviceSlug ?? null);
  if (!featured) {
    return [
      { label: "Reschedule", href: "/customer/bookings", icon: "calendar" as const },
      { label: "Message support", href: "/customer/bookings", icon: "message" as const },
      { label: "Rebook", href: rebookHref, icon: "refresh" as const },
      { label: "Cancel visit", href: "/customer/bookings", icon: "cancel" as const },
    ];
  }

  const support = customerHubSupportQuickLinks({
    id: featured.id,
    isSeriesVisit: featured.isSeriesVisit,
    seriesId: featured.seriesId,
  });

  return [
    { label: "Reschedule", href: support.reschedule, icon: "calendar" as const },
    { label: "Message support", href: support.message, icon: "message" as const },
    { label: "Rebook", href: rebookHref, icon: "refresh" as const },
    { label: "Cancel visit", href: support.cancel, icon: "cancel" as const },
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
