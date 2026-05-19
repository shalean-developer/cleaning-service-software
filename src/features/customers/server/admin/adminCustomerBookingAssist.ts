/**
 * Admin-assisted booking audit (Phase 3F).
 *
 * Production booking creation requires a customer session with actingCustomerId;
 * lock/paystack routes reject admin roles. Command-layer CREATE_BOOKING_DRAFT
 * allows admin actors in tests only — no safe admin HTTP flow exists yet.
 */
export const ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED = false;

export const ADMIN_CUSTOMER_ASSISTED_BOOKING_LABEL = "Create booking for customer";

export const ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE =
  "Admin-assisted booking coming soon";
