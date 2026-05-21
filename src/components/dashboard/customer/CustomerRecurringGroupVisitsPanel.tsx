import Link from "next/link";
import type { CustomerRecurringGroupVisitEntry } from "@/features/recurring/server/recurringManagementTypes";
import { PayNextVisitButton } from "./PayNextVisitButton";

type Props = {
  upcomingVisits: CustomerRecurringGroupVisitEntry[];
  completedVisits: CustomerRecurringGroupVisitEntry[];
  customerEmail: string;
};

export function CustomerRecurringGroupVisitsPanel({
  upcomingVisits,
  completedVisits,
  customerEmail,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Upcoming visits</h3>
        {upcomingVisits.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No upcoming visits scheduled.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcomingVisits.map((v) => (
              <li
                key={v.bookingId}
                className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {v.weekdayLabel} · {v.scheduleLabel}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {v.serviceLabel} · {v.paymentLabel} · {v.priceLabel}
                    </p>
                  </div>
                  <Link
                    href={v.bookingDetailHref}
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                  >
                    Booking detail
                  </Link>
                </div>
                {v.paymentRequired ? (
                  <div className="mt-3">
                    <PayNextVisitButton
                      bookingId={v.bookingId}
                      customerEmail={customerEmail}
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      Pay to confirm this visit. Cleaner assignment starts after payment.
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {completedVisits.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Completed visits</h3>
          <ul className="mt-3 space-y-2">
            {completedVisits.map((v) => (
              <li key={v.bookingId} className="text-sm text-zinc-600">
                <Link
                  href={v.bookingDetailHref}
                  className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                >
                  {v.weekdayLabel} · {v.scheduleLabel}
                </Link>
                {" "}
                — {v.paymentLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
