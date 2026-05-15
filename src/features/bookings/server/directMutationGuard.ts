/**
 * Application-level guard: never patch `bookings.status` (or ORM equivalents)
 * outside {@link executeBookingCommand}. Database triggers/RLS are still planned.
 */
export function forbidBookingStatusInPatch<T extends Record<string, unknown>>(
  patch: T,
): void {
  if (
    Object.prototype.hasOwnProperty.call(patch, "status") &&
    patch.status !== undefined
  ) {
    throw new Error(
      "Direct booking status mutation is forbidden. Route lifecycle changes through executeBookingCommand().",
    );
  }
}
