"use client";

import type { AdminAssistTimelineEntry } from "@/features/bookings/server/admin/buildAdminBookingAssistTimeline";
import {
  formatAdminAssistRelativeTimestamp,
  groupAdminAssistTimelineEntries,
  resolveAdminAssistNextRecommendedAction,
} from "@/features/bookings/server/admin/adminAssistOperatorTimeline";

type Props = {
  entries: AdminAssistTimelineEntry[];
  bookingStatus: string;
  paymentLinkExpired: boolean;
  hasPaymentLink: boolean;
  customerHasEmail: boolean;
  emailFailed: boolean;
  bookingConfirmed: boolean;
  operatorNames?: Record<string, string>;
};

function resolveOperatorLabel(
  adminProfileId: string | null,
  operatorNames?: Record<string, string>,
): string | null {
  if (!adminProfileId) return null;
  return operatorNames?.[adminProfileId] ?? null;
}

export function AdminBookingAssistOperatorTimeline({
  entries,
  bookingStatus,
  paymentLinkExpired,
  hasPaymentLink,
  customerHasEmail,
  emailFailed,
  bookingConfirmed,
  operatorNames,
}: Props) {
  const groups = groupAdminAssistTimelineEntries(entries);
  const nextAction = resolveAdminAssistNextRecommendedAction({
    bookingStatus,
    paymentLinkExpired,
    hasPaymentLink,
    customerHasEmail,
    emailFailed,
    bookingConfirmed,
  });

  if (groups.length === 0) {
    return (
      <p className="text-sm text-zinc-600" data-testid="admin-assist-operator-timeline-empty">
        No assist lifecycle history yet.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-assist-operator-timeline">
      {nextAction ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
          data-testid="admin-assist-next-recommended-action"
        >
          <p className="font-medium">Next recommended action: {nextAction.label}</p>
          <p className="mt-0.5 text-xs">{nextAction.reason}</p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.id} data-testid={`admin-assist-timeline-group-${group.id}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.label}</h3>
          <ol className="mt-2 space-y-3 border-l border-sky-200 pl-4">
            {group.entries.map((entry) => {
              const operator = resolveOperatorLabel(entry.adminProfileId, operatorNames);
              return (
                <li key={entry.id} className="relative text-sm">
                  <span
                    className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-sky-600"
                    aria-hidden
                  />
                  <p className="font-medium text-zinc-900">{entry.title}</p>
                  <p className="text-xs text-zinc-500">
                    {formatAdminAssistRelativeTimestamp(entry.at)}
                    {operator ? ` · ${operator}` : entry.adminProfileId ? " · operator" : ""}
                  </p>
                  {entry.description ? (
                    <p className="mt-0.5 text-xs text-zinc-600">{entry.description}</p>
                  ) : null}
                  {entry.reference ? (
                    <p className="mt-1 font-mono text-xs text-zinc-700">Ref: {entry.reference}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
