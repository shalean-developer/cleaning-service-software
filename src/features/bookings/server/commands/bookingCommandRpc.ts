import type { Json } from "@/lib/database/types";
import type { BookingStatus } from "../types";
import type { TransitionResult } from "./bookingCommandBackend";
import { buildAuditEnvelope } from "./bookingCommandAudit";
import type { BookingCommand } from "./types";

type RpcSuccessBody = {
  ok: boolean;
  idempotent: boolean;
  booking_id: string;
  status: string;
};

export function rpcAuditArgs(cmd: BookingCommand, from: BookingStatus | null, to: BookingStatus) {
  const env = buildAuditEnvelope(cmd, from, to);
  return {
    p_command: env.commandName,
    p_actor_profile_id: cmd.actor.profileId,
    p_actor_type: cmd.actor.actorType,
    p_reason: cmd.reason ?? null,
    p_idempotency_key: cmd.idempotencyKey ?? null,
    p_metadata: env.metadata as Json,
  };
}

export function parseRpcTransitionResult(data: Json | null): TransitionResult {
  const body = data as RpcSuccessBody | null;
  if (!body?.ok) {
    throw new Error("RPC_FAILED");
  }
  return {
    status: body.status as BookingStatus,
    idempotent: Boolean(body.idempotent),
  };
}

export function rethrowRpcError(error: { message?: string }): never {
  const message = error.message ?? "RPC_ERROR";
  if (message.includes("BOOKING_STATUS_CONFLICT")) {
    throw new Error("BOOKING_STATUS_CONFLICT");
  }
  if (message.includes("BOOKING_NOT_FOUND")) {
    throw new Error("BOOKING_NOT_FOUND");
  }
  if (message.includes("BOOKING_NOT_AWAITING_PAYMENT")) {
    throw new Error("INVALID_STATE_FOR_FINALIZE");
  }
  if (message.includes("PAYMENT_NOT_FOUND")) {
    throw new Error("PAYMENT_NOT_FOUND");
  }
  if (message.includes("IDEMPOTENCY_KEY_REQUIRED")) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  throw new Error(message);
}
