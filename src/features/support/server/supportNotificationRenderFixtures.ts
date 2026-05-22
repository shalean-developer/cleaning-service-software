import type { ParsedSupportOutboxPayload } from "./parseSupportOutboxPayload";

const BASE_FIXTURE: Omit<
  ParsedSupportOutboxPayload,
  "template" | "event" | "dedupeKey" | "requestStatus" | "customerResponse"
> = {
  requestId: "req-fixture-1",
  source: "booking_support",
  requestType: "reschedule",
  bookingId: "booking-fixture-1",
  seriesId: null,
  groupId: null,
  customerId: "cust-fixture-1",
  customerName: "Jane Doe",
  customerContact: "jane@example.com",
  messagePreview: "Please move my visit to next week.",
  ctaPath: "/customer/bookings/booking-fixture-1#booking-support",
};

export const SUPPORT_NOTIFICATION_RENDER_FIXTURES: ParsedSupportOutboxPayload[] = [
  {
    ...BASE_FIXTURE,
    template: "support_request_created",
    event: "support_request_created",
    dedupeKey: "support_request:booking_support:req-fixture-1:open",
    requestStatus: "open",
    customerResponse: null,
  },
  {
    ...BASE_FIXTURE,
    template: "support_request_acknowledged",
    event: "support_request_acknowledged",
    dedupeKey: "support_request:booking_support:req-fixture-1:acknowledged",
    requestStatus: "acknowledged",
    customerResponse: null,
  },
  {
    ...BASE_FIXTURE,
    template: "support_request_resolved",
    event: "support_request_resolved",
    dedupeKey: "support_request:booking_support:req-fixture-1:resolved",
    requestStatus: "resolved",
    customerResponse: "We updated your booking time.",
  },
  {
    ...BASE_FIXTURE,
    template: "support_request_rejected",
    event: "support_request_rejected",
    dedupeKey: "support_request:booking_support:req-fixture-1:rejected",
    requestStatus: "rejected",
    requestType: "cancel",
    customerResponse: "We could not cancel at this time.",
  },
  {
    ...BASE_FIXTURE,
    template: "support_request_admin_urgent",
    event: "support_request_admin_urgent",
    dedupeKey: "support_request:booking_support:req-fixture-1:open",
    requestStatus: "open",
    requestType: "payment_help",
    customerResponse: null,
  },
];
