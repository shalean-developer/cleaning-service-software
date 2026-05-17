import type { Json } from "@/lib/database/types";
import type { BookingCommandBackend } from "./bookingCommandBackend";

/**
 * Whether to insert a notification_outbox row after a command persisted.
 * Idempotent command replays must not enqueue duplicate notifications (Stage 5C-0).
 *
 * Default: idempotent result → do not enqueue. No template-specific exceptions yet.
 */
export function shouldEnqueueNotificationForCommandResult(
  idempotent: boolean,
): boolean {
  return !idempotent;
}

/** Enqueues only when the command transition was not an idempotent replay. */
export async function enqueueNotificationWhenNotIdempotent(
  backend: BookingCommandBackend,
  idempotent: boolean,
  channel: string,
  recipient: string,
  payload: Json,
): Promise<void> {
  if (!shouldEnqueueNotificationForCommandResult(idempotent)) return;
  await backend.enqueueNotification(channel, recipient, payload);
}
