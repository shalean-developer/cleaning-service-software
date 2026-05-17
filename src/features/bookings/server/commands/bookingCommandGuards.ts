import type { BookingStatus } from "../types";
import type {
  BookingActorType,
  BookingCommand,
  BookingCommandFailure,
  BookingCommandType,
} from "./types";

const terminal: ReadonlySet<BookingStatus> = new Set([
  "cancelled",
  "paid_out",
  "payment_failed",
]);

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return terminal.has(status);
}

const roleAllows =
  (roles: ReadonlySet<BookingActorType>) =>
  (actor: BookingActorType): boolean =>
    roles.has(actor);

const customerOrAdmin = new Set<BookingActorType>([
  "customer",
  "admin",
  "system",
  "service",
]);
const adminOnly = new Set<BookingActorType>(["admin"]);
const systemish = new Set<BookingActorType>(["admin", "system", "service"]);
const cleanerOrAdmin = new Set<BookingActorType>(["cleaner", "admin"]);
const cleanerAdminSystem = new Set<BookingActorType>([
  "cleaner",
  "admin",
  "system",
  "service",
]);

function commandActorPolicy(
  type: BookingCommandType,
): ReadonlySet<BookingActorType> {
  switch (type) {
    case "CREATE_BOOKING_DRAFT":
      return customerOrAdmin;
    case "MARK_PAYMENT_PENDING":
      return customerOrAdmin;
    case "FINALIZE_PAYMENT_SUCCESS":
      return systemish;
    case "MARK_PAYMENT_FAILED":
      return systemish;
    case "MOVE_TO_PENDING_ASSIGNMENT":
      return systemish;
    case "OFFER_TO_CLEANER":
      return systemish;
    case "ACCEPT_CLEANER_ASSIGNMENT":
      return cleanerOrAdmin;
    case "DECLINE_CLEANER_ASSIGNMENT":
      return cleanerOrAdmin;
    case "CANCEL_OPEN_ASSIGNMENT_OFFER":
      return adminOnly;
    case "MARK_IN_PROGRESS":
    case "MARK_BOOKING_IN_PROGRESS":
      return cleanerAdminSystem;
    case "MARK_COMPLETED":
    case "MARK_BOOKING_COMPLETED":
      return cleanerAdminSystem;
    case "MARK_BOOKING_PAYOUT_READY":
    case "MARK_BOOKING_PAID_OUT":
      return adminOnly;
    case "CANCEL_BOOKING":
      return customerOrAdmin;
    case "ADMIN_OVERRIDE_STATUS":
      return adminOnly;
    case "RECORD_ASSIGNMENT_ATTENTION":
      return systemish;
  }
}

export function assertActorAuthorizedForCommand(
  cmd: BookingCommand,
): BookingCommandFailure | null {
  const allowed = commandActorPolicy(cmd.type);
  if (!roleAllows(allowed)(cmd.actor.actorType)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Actor type "${cmd.actor.actorType}" may not run "${cmd.type}".`,
    };
  }
  if (cmd.type === "ADMIN_OVERRIDE_STATUS" && !cmd.reason?.trim()) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "ADMIN_OVERRIDE_STATUS requires a non-empty reason.",
    };
  }
  return null;
}

/**
 * Returns the next booking status for pure status-changing commands,
 * or `null` when the command does not itself change booking.status
 * (e.g. offers / declines handled separately).
 */
export function nextStatusForCommand(
  cmd: BookingCommand,
  current: BookingStatus,
): BookingStatus | null {
  switch (cmd.type) {
    case "CREATE_BOOKING_DRAFT":
      return "draft";
    case "MARK_PAYMENT_PENDING": {
      if (current === "draft" || current === "payment_failed") {
        return "pending_payment";
      }
      return null;
    }
    case "FINALIZE_PAYMENT_SUCCESS":
      return current === "pending_payment" ? "confirmed" : null;
    case "MARK_PAYMENT_FAILED":
      return current === "pending_payment" ? "payment_failed" : null;
    case "MOVE_TO_PENDING_ASSIGNMENT":
      return current === "confirmed" ? "pending_assignment" : null;
    case "OFFER_TO_CLEANER":
    case "DECLINE_CLEANER_ASSIGNMENT":
    case "CANCEL_OPEN_ASSIGNMENT_OFFER":
      return null;
    case "ACCEPT_CLEANER_ASSIGNMENT":
      return current === "pending_assignment" ? "assigned" : null;
    case "MARK_IN_PROGRESS":
    case "MARK_BOOKING_IN_PROGRESS":
      return current === "assigned" ? "in_progress" : null;
    case "MARK_COMPLETED":
    case "MARK_BOOKING_COMPLETED":
      return current === "in_progress" ? "completed" : null;
    case "MARK_BOOKING_PAYOUT_READY":
      return current === "completed" ? "payout_ready" : null;
    case "MARK_BOOKING_PAID_OUT":
      return current === "payout_ready" ? "paid_out" : null;
    case "CANCEL_BOOKING":
      if (terminal.has(current)) return null;
      return "cancelled";
    case "ADMIN_OVERRIDE_STATUS":
      return cmd.nextStatus;
    case "RECORD_ASSIGNMENT_ATTENTION":
      return null;
    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}

export function assertTransitionShape(
  cmd: BookingCommand,
  current: BookingStatus,
): BookingCommandFailure | null {
  if (cmd.type === "ADMIN_OVERRIDE_STATUS" || cmd.type === "RECORD_ASSIGNMENT_ATTENTION") {
    return null;
  }

  if (cmd.type === "MARK_PAYMENT_PENDING" && current === "payment_failed") {
    return nextStatusForCommand(cmd, current) === null
      ? {
          ok: false,
          code: "INVALID_TRANSITION",
          message: `Command "${cmd.type}" is not valid from "${current}".`,
        }
      : null;
  }

  if (terminal.has(current)) {
    return {
      ok: false,
      code: "TERMINAL_STATE",
      message: `Command "${cmd.type}" is not allowed from terminal status "${current}".`,
    };
  }

  const expected = nextStatusForCommand(cmd, current);
  if (
    cmd.type === "OFFER_TO_CLEANER" ||
    cmd.type === "DECLINE_CLEANER_ASSIGNMENT" ||
    cmd.type === "CANCEL_OPEN_ASSIGNMENT_OFFER"
  ) {
    if (current !== "pending_assignment") {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `"${cmd.type}" requires status pending_assignment (got "${current}").`,
      };
    }
    return null;
  }

  if (cmd.type === "CREATE_BOOKING_DRAFT") {
    return null;
  }

  if (expected === null) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Command "${cmd.type}" is not valid from "${current}".`,
    };
  }

  return null;
}
