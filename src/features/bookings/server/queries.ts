import type { BookingId, BookingStatus } from "./types";

/**
 * Legacy booking query helpers. Dashboards use
 * `@/features/dashboards/server/*ReadModel` with RLS-scoped clients instead.
 */

export type BookingRecord = {
  id: BookingId;
  status: BookingStatus;
  updatedAt: string;
};

export async function getBookingById(
  _id: BookingId,
): Promise<BookingRecord | null> {
  void _id;
  return null;
}

export async function listBookingsForCustomer(
  _customerId: string,
): Promise<BookingRecord[]> {
  void _customerId;
  return [];
}
