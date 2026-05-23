import type { Json } from "@/lib/database/types";

export type AdminAssistBookingMetadata = {
  createdByProfileId?: string;
  createdAt?: string;
  source?: string;
  idempotencyKey?: string;
  phase?: string;
  /** Internal pilot/dry-run label — does not bypass lifecycle. */
  pilotDryRun?: boolean;
  pilotDryRunAt?: string;
};

export function readAdminAssistMetadata(
  metadata: Json | null | undefined,
): AdminAssistBookingMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const root = metadata as Record<string, unknown>;
  const adminAssist = root.adminAssist;
  if (!adminAssist || typeof adminAssist !== "object" || Array.isArray(adminAssist)) {
    return null;
  }
  const assist = adminAssist as Record<string, unknown>;
  return {
    createdByProfileId:
      typeof assist.createdByProfileId === "string" ? assist.createdByProfileId : undefined,
    createdAt: typeof assist.createdAt === "string" ? assist.createdAt : undefined,
    source: typeof assist.source === "string" ? assist.source : undefined,
    idempotencyKey:
      typeof assist.idempotencyKey === "string" ? assist.idempotencyKey : undefined,
    phase: typeof assist.phase === "string" ? assist.phase : undefined,
    pilotDryRun: assist.pilotDryRun === true,
    pilotDryRunAt: typeof assist.pilotDryRunAt === "string" ? assist.pilotDryRunAt : undefined,
  };
}

export function isAdminAssistPilotDryRun(metadata: Json | null | undefined): boolean {
  return readAdminAssistMetadata(metadata)?.pilotDryRun === true;
}

export function isAdminAssistedBookingMetadata(metadata: Json | null | undefined): boolean {
  const assist = readAdminAssistMetadata(metadata);
  return assist?.source === "admin_wizard" || assist?.phase === "draft_only";
}
