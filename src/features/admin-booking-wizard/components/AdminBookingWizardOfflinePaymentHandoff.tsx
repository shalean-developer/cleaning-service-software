import Link from "next/link";

type Props = {
  bookingId: string;
  offlinePaymentsEnabled: boolean;
};

export function AdminBookingWizardOfflinePaymentHandoff({
  bookingId,
  offlinePaymentsEnabled,
}: Props) {
  if (!offlinePaymentsEnabled) return null;

  return (
    <section
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      data-testid="admin-booking-offline-handoff-card"
    >
      <p className="font-semibold">Record EFT / cash / card-machine payment on booking detail</p>
      <p className="mt-2 text-xs leading-relaxed">
        This booking is pending payment. To accept an offline payment, open the booking detail page,
        record the payment there, and the system will finalize the booking and start normal cleaner
        assignment after confirmation.
      </p>
      <Link
        href={`/admin/bookings/${bookingId}`}
        className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-4 text-sm font-medium underline-offset-2 hover:underline"
        data-testid="admin-booking-offline-handoff-link"
      >
        Open booking detail to record offline payment
      </Link>
    </section>
  );
}
