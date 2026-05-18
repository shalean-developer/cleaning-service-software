import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";

const DEFERRED_ASSIGNMENT_REASON =
  "Assignment deferred until dispatch window; cron will run post-payment assignment.";

export function logAssignmentDeferred(input: {
  bookingId: string;
  paymentId: string;
  assignmentDispatchAt: string;
}): void {
  console.info(
    JSON.stringify({
      event: "assignment_deferred",
      at: new Date().toISOString(),
      ...input,
    }),
  );
}

export async function recordDeferredAssignment(
  backend: BookingCommandBackend,
  bookingId: string,
  assignmentDispatchAt: string,
): Promise<void> {
  await recordAssignmentOutcome(backend, bookingId, {
    status: "deferred",
    path: null,
    cleanerId: null,
    offerId: null,
    reason: `${DEFERRED_ASSIGNMENT_REASON} dispatch_at=${assignmentDispatchAt}`,
  });
}
