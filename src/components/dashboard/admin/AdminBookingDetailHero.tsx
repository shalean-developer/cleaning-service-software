import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_DETAIL_INSET_CLASS,
} from "@/features/dashboards/adminDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";

export type AdminBookingDetailHeroBadge = {
  label: string;
  tone: StatusBadgeTone;
};

type SummaryRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

type Props = {
  serviceLabel: string;
  bookingId: string;
  badges: AdminBookingDetailHeroBadge[];
  rows: SummaryRow[];
  paymentAlert?: ReactNode;
  footer?: ReactNode;
};

export function AdminBookingDetailHero({
  serviceLabel,
  bookingId,
  badges,
  rows,
  paymentAlert,
  footer,
}: Props) {
  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} overflow-hidden`}>
      <header className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-3.5 sm:px-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Service</p>
        <h1 className="mt-0.5 break-words text-lg font-semibold tracking-tight text-zinc-900">
          {serviceLabel}
        </h1>
        <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">{bookingId}</p>
        <section className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
          ))}
        </section>
      </header>

      <section className="px-4 py-3.5 sm:px-5 sm:py-4">
        {paymentAlert ? <section className="mb-3">{paymentAlert}</section> : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-6">
          {rows.map((row) => (
            <section key={row.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {row.label}
              </dt>
              <dd
                className={`mt-0.5 break-words font-medium text-zinc-900 ${row.valueClassName ?? ""}`}
              >
                {row.value}
              </dd>
            </section>
          ))}
        </dl>

        {footer ? <section className="mt-3 border-t border-zinc-100 pt-3">{footer}</section> : null}
      </section>
    </section>
  );
}

export function AdminPaymentFailureInset({ children }: { children: ReactNode }) {
  return (
    <p className={`${ADMIN_DETAIL_INSET_CLASS} border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950`}>
      {children}
    </p>
  );
}
