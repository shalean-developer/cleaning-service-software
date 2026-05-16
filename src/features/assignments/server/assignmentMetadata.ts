import type { Json } from "@/lib/database/types";
import type { AssignmentMetadata } from "./types";

export function readAssignmentMetadata(
  metadata: Json | null | undefined,
): AssignmentMetadata | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const assignment = record.assignment;
  if (assignment == null || typeof assignment !== "object" || Array.isArray(assignment)) {
    return null;
  }
  const a = assignment as Record<string, unknown>;
  if (typeof a.attemptedAt !== "string" || typeof a.status !== "string") {
    return null;
  }
  return {
    engineVersion: (a.engineVersion as AssignmentMetadata["engineVersion"]) ?? "2026-05-16-phase8",
    status: a.status as AssignmentMetadata["status"],
    path: (a.path as AssignmentMetadata["path"]) ?? null,
    cleanerId: typeof a.cleanerId === "string" ? a.cleanerId : null,
    offerId: typeof a.offerId === "string" ? a.offerId : null,
    reason: typeof a.reason === "string" ? a.reason : null,
    attemptedAt: a.attemptedAt,
  };
}

export function mergeBookingMetadataAssignment(
  metadata: Json | null | undefined,
  assignment: AssignmentMetadata,
): Record<string, unknown> {
  const base =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, assignment };
}
