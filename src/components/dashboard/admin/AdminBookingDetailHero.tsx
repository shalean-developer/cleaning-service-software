import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_DETAIL_INSET_CLASS,
} from "@/features/dashboards/adminDisplay";
import type { AdminBookingHeroRow } from "@/features/dashboards/adminBookingDetailDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";

export type AdminBookingDetailHeroBadge = {
  label: string;
  tone: StatusBadgeTone;
};

type Props = {
  serviceLabel: string;
  bookingId: string;
  badges: AdminBookingDetailHeroBadge[];
  essentialRows: AdminBookingHeroRow[];
  contextRows: AdminBookingHeroRow[];
  contextSectionTitle?: string;
  paymentAlert?: ReactNode;
  footer?: ReactNode;
};

export function AdminBookingDetailHero({
  serviceLabel,
  bookingId,
  badges,
  essentialRows,
  contextRows,
  contextSectionTitle = "Booking context",
  paymentAlert,
  footer,
}: Props) {
  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} overflow-hidden`}>
      <header className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:px-5">
        <h1 className="break-words text-lg font-semibold tracking-tight text-zinc-900">
          {serviceLabel}
        </h1>
        <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-400">{bookingId}</p>
        <section className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
          ))}
        </section>
      </header>

      <section className="px-4 py-3 sm:px-5">
        {paymentAlert ? <section className="mb-2.5">{paymentAlert}</section> : null}

        <dl className="grid gap-2.5 text-sm sm:grid-cols-2 sm:gap-x-5">
          {essentialRows.map((row) => (
            <HeroRow key={row.label} {...row} />
          ))}
        </dl>

        {contextRows.length > 0 ? (
          <details className="mt-2.5 text-sm">
            <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900">
              {contextSectionTitle}
            </summary>
            <dl className="mt-2 grid gap-2.5 sm:grid-cols-2 sm:gap-x-5">
              {contextRows.map((row) => (
                <HeroRow key={row.label} {...row} />
              ))}
            </dl>
          </details>
        ) : null}

        {footer ? <section className="mt-2.5 border-t border-zinc-100 pt-2.5">{footer}</section> : null}
      </section>
    </section>
  );
}

function HeroRow({ label, value, valueClassName }: AdminBookingHeroRow) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 break-words font-medium text-zinc-900 ${valueClassName ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}

export function AdminPaymentFailureInset({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${ADMIN_DETAIL_INSET_CLASS} border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm leading-snug text-amber-950`}
      role="alert"
    >
      {children}
    </p>
  );
}
