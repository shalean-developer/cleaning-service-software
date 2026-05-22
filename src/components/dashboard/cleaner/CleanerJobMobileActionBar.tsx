"use client";

import { JobCompletionActions } from "@/components/dashboard/JobCompletionActions";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  bookingId: string;
  status: BookingStatus;
};

/** Fixed mobile bar for start/complete. desktop keeps actions in the hero. */
export function CleanerJobMobileActionBar({ bookingId, status }: Props) {
  if (status !== "assigned" && status !== "in_progress") {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-shadow duration-150 sm:hidden"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <JobCompletionActions bookingId={bookingId} status={status} compact />
      </div>
      <div className="h-[calc(5rem+env(safe-area-inset-bottom,0px))] shrink-0 sm:hidden" aria-hidden />
    </>
  );
}
