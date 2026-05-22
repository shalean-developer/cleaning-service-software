import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CustomerBookACleanCta } from "@/components/dashboard/customer/CustomerBookACleanCta";
import { customerBookingListCardLayers } from "@/features/dashboards/customerBookingListCardDisplay";
import {
  customerHubCleanerInitials,
  customerHubFullAddress,
  customerHubRebookHref,
  customerHubVisitMetaTags,
  customerHubVisitSummaryLine,
  formatHubVisitScheduleLine,
} from "@/features/dashboards/customerHubDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";
import { labelForCustomerBookingStatus } from "@/features/bookings/server/paymentFailureDisplay";
import { customerHubSupportQuickLinks } from "@/features/bookings/server/bookingSupportRequestTypes";

type Props = {
  featured: CustomerBookingListItem | null;
  alsoScheduled: CustomerBookingListItem | null;
};

function HubActionLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "calendar" | "message" | "refresh" | "cancel";
}) {
  const iconClass = "h-3.5 w-3.5";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-shalean-primary"
    >
      {icon === "calendar" ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M8 3v2m8-2v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      ) : null}
      {icon === "message" ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z" />
        </svg>
      ) : null}
      {icon === "refresh" ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M4 12a8 8 0 0 1 13.3-5.7M20 6v4h-4M20 12a8 8 0 0 1-13.3 5.7M4 18v-4h4" />
        </svg>
      ) : null}
      {icon === "cancel" ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M8 8l8 8M16 8l-8 8" />
        </svg>
      ) : null}
      {label}
    </Link>
  );
}

export function CustomerHomeUpcomingCard({ featured, alsoScheduled }: Props) {
  if (!featured) {
    return (
      <section className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-[#f0f5ff] to-blue-50/50 px-5 py-6 sm:px-6 sm:py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700/80">
          Your next visit
        </p>
        <h2 className="mt-2 font-serif text-2xl font-medium text-shalean-navy">No upcoming visits</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-600">
          Book your next clean in under 2 minutes — we will match a cleaner after checkout.
        </p>
        <div className="mt-5">
          <CustomerBookACleanCta />
        </div>
      </section>
    );
  }

  const layers = customerBookingListCardLayers({
    status: featured.status,
    paymentStatus: featured.paymentStatus,
    paymentFailureReason: featured.paymentFailureReason,
    isUpcoming: featured.isUpcoming,
    display: featured.display,
    deferredAssignmentMessage: featured.deferredAssignmentMessage,
    assignedCleanerLabel: featured.assignedCleanerLabel,
  });
  const scheduleLine = formatHubVisitScheduleLine(featured);
  const amount = formatZar(featured.priceCents, featured.currency);
  const tags = customerHubVisitMetaTags(featured);
  const summaryLine = customerHubVisitSummaryLine(featured);
  const address = customerHubFullAddress(featured);
  const supportLinks = customerHubSupportQuickLinks({
    id: featured.id,
    isSeriesVisit: featured.isSeriesVisit,
    seriesId: featured.seriesId,
  });
  const detailHref = `/customer/bookings/${featured.id}`;
  const rebookHref = customerHubRebookHref(featured.display.serviceSlug);
  const assigned = featured.assignedCleanerLabel?.trim();

  return (
    <section className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-[#f0f5ff] to-blue-50/50 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700/80">
          Your next visit
        </p>
        <div className="flex flex-wrap gap-1.5">
          {assigned ? <StatusBadge label="Assigned" tone="info" variant="soft" /> : null}
          <StatusBadge label={layers.dominantBadge.label} tone={layers.dominantBadge.tone} variant="soft" />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-shalean-navy sm:text-[1.65rem]">
            {featured.display.serviceLabel}
          </h2>
          <p className="mt-2 text-sm font-medium text-zinc-800">{scheduleLine}</p>

          {tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-zinc-200/90 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            {featured.display.frequencyLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path strokeLinecap="round" d="M8 3v2m8-2v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                </svg>
                {featured.display.frequencyLabel}
              </span>
            ) : null}
            {featured.isSeriesVisit ? (
              <StatusBadge label="Recurring" tone="info" variant="soft" />
            ) : null}
            {address ? (
              <span className="inline-flex min-w-0 items-start gap-1.5">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z" />
                  <circle cx="12" cy="11" r="2" />
                </svg>
                <span className="break-words">{address}</span>
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            {summaryLine} · {amount}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-blue-100/80 pt-4">
            <HubActionLink href={supportLinks.reschedule} label="Reschedule" icon="calendar" />
            <HubActionLink href={supportLinks.message} label="Message support" icon="message" />
            <HubActionLink href={rebookHref} label="Rebook" icon="refresh" />
            <HubActionLink href={supportLinks.cancel} label="Cancel" icon="cancel" />
          </div>
        </div>

        {assigned ? (
          <div className="w-full shrink-0 rounded-xl border border-white/80 bg-white px-4 py-3.5 shadow-sm sm:max-w-[220px]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-shalean-primary">
                {customerHubCleanerInitials(assigned)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{assigned}</p>
                {layers.supportingMessage?.kind === "cleaner" ? (
                  <p className="mt-0.5 text-xs text-zinc-500">{layers.supportingMessage.text}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-zinc-500">Usually cleans homes in your area.</p>
                )}
                <Link
                  href={detailHref}
                  className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-wide text-shalean-primary hover:underline"
                >
                  View profile
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {alsoScheduled ? (
        <div className="mt-5 rounded-xl border border-white/90 bg-white/90 px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Also scheduled
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800">
              {alsoScheduled.display.serviceLabel} · {formatHubVisitScheduleLine(alsoScheduled)}
            </p>
            <div className="flex gap-1.5">
              <StatusBadge
                label={labelForCustomerBookingStatus(
                  alsoScheduled.status,
                  alsoScheduled.paymentFailureReason,
                )}
                tone="info"
                variant="soft"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
