export const CUSTOMER_ACTIVITY_TIMELINE_LIMIT = 20;

export type CustomerTimelineSource = "Customer" | "Booking" | "Payment" | "Admin" | "System";

export type CustomerOperationalTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  source: CustomerTimelineSource;
  bookingId: string | null;
  bookingHref: string | null;
};

export type CustomerOperationalTimelineResult =
  | { ok: true; events: CustomerOperationalTimelineEvent[] }
  | { ok: false; code: string; message: string; status: number };
