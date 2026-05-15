import type { BookingId, BookingStatus } from "./types";

/**
 * Read models for bookings. Replace with Supabase queries + RLS-safe clients later.
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
