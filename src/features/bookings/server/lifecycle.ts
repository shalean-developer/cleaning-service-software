/**
 * Booking lifecycle is enforced by {@link executeBookingCommand} and
 * {@link bookingCommandGuards}. The legacy `applyBookingCommand` helper was removed
 * in favor of typed commands (`CREATE_BOOKING_DRAFT`, `FINALIZE_PAYMENT_SUCCESS`, …).
 */

export {
  assertActorAuthorizedForCommand,
  assertTransitionShape,
  isTerminalBookingStatus,
  nextStatusForCommand,
} from "./commands/bookingCommandGuards";
