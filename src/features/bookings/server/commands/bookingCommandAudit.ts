import type { Json } from "@/lib/database/types";
import type { BookingStatus } from "../types";
import type { BookingCommand } from "./types";

export type BookingAuditInsert = {
  booking_id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus | null;
  command: string;
  actor_profile_id: string | null;
  actor_type: string;
  reason: string | null;
  idempotency_key: string | null;
  metadata: Json;
  payload: Json;
};

export function buildAuditEnvelope(
  cmd: BookingCommand,
  fromStatus: BookingStatus | null,
  toStatus: BookingStatus | null,
): { metadata: Json; payload: Json; commandName: string } {
  const metadata: Json = {
    commandType: cmd.type,
    ...(cmd.metadata && typeof cmd.metadata === "object"
      ? cmd.metadata
      : {}),
  };

  const payload: Json = {
    command: cmd.type,
    from_status: fromStatus,
    to_status: toStatus,
    actor_type: cmd.actor.actorType,
    actor_profile_id: cmd.actor.profileId,
    reason: cmd.reason ?? null,
    idempotency_key: cmd.idempotencyKey ?? null,
    metadata,
  };

  return {
    metadata,
    payload,
    commandName: cmd.type,
  };
}
