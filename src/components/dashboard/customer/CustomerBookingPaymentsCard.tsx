import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { CUSTOMER_BOOKING_DETAIL_CARD_CLASS } from "@/features/dashboards/customerBookingDetailDisplay";
import {
  labelForPaymentStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { PaymentSummary } from "@/features/dashboards/server/types";

type Props = {
  payments: PaymentSummary[];
};

export function CustomerBookingPaymentsCard({ payments }: Props) {
  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-semibold text-zinc-900">Payments</h2>
      {payments.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No payment records.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
              <section className="min-w-0 flex-1">
                <StatusBadge
                  label={labelForPaymentStatus(payment.status)}
                  tone={toneForPaymentStatus(payment.status)}
                  variant="soft"
                />
                {payment.providerRef ? (
                  <p className="mt-1.5 truncate text-[11px] text-zinc-400">
                    Ref {payment.providerRef}
                  </p>
                ) : null}
              </section>
              <p className="shrink-0 text-base font-semibold tabular-nums text-zinc-900">
                {formatZar(payment.amountCents, payment.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
