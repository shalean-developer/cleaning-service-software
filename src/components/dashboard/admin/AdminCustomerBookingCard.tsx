import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForBookingStatus,
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { AdminCustomerBookingHistoryItem } from "@/features/customers/server/admin/types";
import type { PaymentStatus } from "@/lib/database/types";

type Props = {
  booking: AdminCustomerBookingHistoryItem;
};

function formatZar(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatSchedule(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = startDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = startDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = endDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${startTime}–${endTime}`;
}

export function AdminCustomerBookingCard({ booking }: Props) {
  const bookingStatus = booking.status as BookingStatus;
  const showPaymentBadge =
    booking.paymentStatus != null &&
    bookingStatus !== "draft" &&
    bookingStatus !== "cancelled";

  return (
    <li className="px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/bookings/${booking.id}`}
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              {booking.bookingReference}
            </Link>
            <span className="text-xs text-zinc-500">Ref</span>
          </div>
          <p className="text-sm font-medium text-zinc-800">
            {booking.serviceLabel ?? "Service"}
            {booking.frequencyLabel ? ` · ${booking.frequencyLabel}` : ""}
          </p>
          <p className="text-sm text-zinc-600">
            {formatSchedule(booking.scheduledStart, booking.scheduledEnd)}
          </p>
          {booking.assignedCleanerLabel ? (
            <p className="text-sm text-zinc-600">Assigned: {booking.assignedCleanerLabel}</p>
          ) : (
            <p className="text-sm text-zinc-500">No cleaner assigned yet</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge
              label={labelForBookingStatus(bookingStatus)}
              tone={toneForBookingStatus(bookingStatus)}
              variant="soft"
            />
            {showPaymentBadge ? (
              <StatusBadge
                label={labelForPaymentStatus(booking.paymentStatus as PaymentStatus)}
                tone={toneForPaymentStatus(booking.paymentStatus as PaymentStatus)}
                variant="soft"
              />
            ) : null}
          </div>
          <p className="text-sm font-medium text-zinc-900">
            {formatZar(booking.priceCents, booking.currency)}
          </p>
        </div>
      </div>
    </li>
  );
}
