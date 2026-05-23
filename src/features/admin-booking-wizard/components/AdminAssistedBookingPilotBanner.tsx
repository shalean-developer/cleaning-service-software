"use client";

import Link from "next/link";

type Props = {
  pilotMode: boolean;
};

export function AdminAssistedBookingPilotBanner({ pilotMode }: Props) {
  if (!pilotMode) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      data-testid="admin-assisted-booking-pilot-banner"
    >
      <p className="font-semibold">Admin-assisted booking is in pilot mode.</p>
      <p className="mt-1 text-amber-900/90">
        Internal operators only. Report issues with booking ID and payment reference. Do not bypass
        payment confirmation or assignment gates.
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
        <Link
          href="/admin/operations/admin-assisted-bookings"
          className="text-amber-950 underline-offset-2 hover:underline"
        >
          Operations dashboard
        </Link>
        <span className="text-amber-800">
          Feedback: note in ops channel with <code className="rounded bg-amber-100 px-1">#admin-assist-pilot</code>
        </span>
      </div>
    </div>
  );
}
