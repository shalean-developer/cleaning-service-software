import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";

/**
 * Returns true when a booking may complete: paid payment OR active monthly service authorization.
 * Does not mark invoices paid or create accrual rows.
 */
export async function hasFinancialClearanceForCompletion(
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<boolean> {
  return backend.hasFinancialClearanceForCompletion(bookingId);
}
