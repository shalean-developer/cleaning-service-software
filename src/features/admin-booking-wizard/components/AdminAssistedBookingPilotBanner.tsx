"use client";

import Link from "next/link";
import {
  ADMIN_ASSISTED_ROLLOUT_STAGE_DESCRIPTIONS,
  type AdminAssistedBookingRolloutStage,
} from "@/lib/app/resolveAdminAssistedBookingRolloutStage";
import { AdminAssistedRolloutStageBadge } from "@/components/dashboard/admin/AdminAssistedRolloutStageBadge";

type Props = {
  pilotMode: boolean;
  rolloutStage: AdminAssistedBookingRolloutStage;
};

export function AdminAssistedBookingPilotBanner({ pilotMode, rolloutStage }: Props) {
  if (!pilotMode && rolloutStage === "disabled") {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      data-testid="admin-assisted-booking-pilot-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {pilotMode ? (
            <>
              <p className="font-semibold">Admin-assisted booking is in pilot mode.</p>
              <p className="mt-1 text-amber-900/90">
                Internal operators only. Report issues with booking ID and payment reference. Do not bypass
                payment confirmation or assignment gates.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Admin-assisted booking rollout active</p>
              <p className="mt-1 text-amber-900/90">
                {ADMIN_ASSISTED_ROLLOUT_STAGE_DESCRIPTIONS[rolloutStage]}
              </p>
            </>
          )}
        </div>
        <AdminAssistedRolloutStageBadge stage={rolloutStage} compact />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
        <Link
          href="/admin/operations/admin-assisted-bookings"
          className="text-amber-950 underline-offset-2 hover:underline"
        >
          Operations dashboard
        </Link>
        {pilotMode ? (
          <span className="text-amber-800">
            Feedback: note in ops channel with{" "}
            <code className="rounded bg-amber-100 px-1">#admin-assist-pilot</code>
          </span>
        ) : null}
      </div>
    </div>
  );
}
