import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { AssignmentMetadata } from "./types";
import { ASSIGNMENT_ENGINE_VERSION } from "./types";

const systemActor = { actorType: "service" as const, profileId: null };

export async function recordAssignmentOutcome(
  backend: BookingCommandBackend,
  bookingId: string,
  assignment: Omit<AssignmentMetadata, "engineVersion" | "attemptedAt">,
): Promise<void> {
  const payload: AssignmentMetadata = {
    engineVersion: ASSIGNMENT_ENGINE_VERSION,
    attemptedAt: new Date().toISOString(),
    ...assignment,
  };

  await executeBookingCommand(
    backend,
    {
      type: "RECORD_ASSIGNMENT_ATTENTION",
      actor: systemActor,
      bookingId,
      assignment: payload,
      idempotencyKey: `assignment:meta:${bookingId}:${payload.status}:${payload.path ?? "none"}`,
    },
    {},
  );
}
