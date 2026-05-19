import "server-only";

import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SLUGS } from "@/features/pricing/server/types";
import { readWorkingDaysFromPayload } from "@/features/cleaners/admin/cleanerAvailability";
import {
  validateCleanerEditForm,
  type CleanerEditFormValues,
} from "@/features/cleaners/admin/cleanerProfileEditValidation";
import {
  findForbiddenImmutableProfileKeys,
  findForbiddenLifecycleKeys,
} from "./profilePayloadGuards";

const VALID_SLUGS = new Set<string>(SERVICE_SLUGS);

export type ParsedUpdateCleanerProfileBody = CleanerEditFormValues & {
  idempotencyKey?: string | null;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readCapabilities(value: unknown): ServiceSlug[] {
  if (!Array.isArray(value)) return [];
  const slugs: ServiceSlug[] = [];
  for (const item of value) {
    if (typeof item === "string" && VALID_SLUGS.has(item)) {
      slugs.push(item as ServiceSlug);
    }
  }
  return slugs;
}

export function parseUpdateCleanerProfileBody(
  body: unknown,
):
  | { ok: true; values: ParsedUpdateCleanerProfileBody }
  | { ok: false; code: string; message: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Request body must be JSON." };
  }

  const record = body as Record<string, unknown>;
  const lifecycleKeys = findForbiddenLifecycleKeys(record);
  if (lifecycleKeys.length > 0) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Lifecycle fields cannot be changed from profile edit.",
    };
  }

  const immutableKeys = findForbiddenImmutableProfileKeys(record);
  if (immutableKeys.length > 0) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Phone, email, and password cannot be changed from profile edit.",
    };
  }

  const values: ParsedUpdateCleanerProfileBody = {
    fullName: readString(record.fullName),
    serviceAreasInput: readString(record.serviceAreasInput),
    capabilities: readCapabilities(record.capabilities),
    workingDays: readWorkingDaysFromPayload(record.workingDays),
    startTime: readString(record.startTime),
    endTime: readString(record.endTime),
    timezone: readString(record.timezone),
    idempotencyKey:
      typeof record.idempotencyKey === "string" ? record.idempotencyKey : null,
  };

  const validation = validateCleanerEditForm(values);
  if (!validation.valid) {
    const firstError =
      validation.errors.fullName ??
      validation.errors.capabilities ??
      validation.errors.serviceAreasInput ??
      validation.errors.workingDays ??
      validation.errors.startTime ??
      validation.errors.endTime ??
      validation.errors.timezone ??
      "Invalid cleaner profile payload.";
    return { ok: false, code: "INVALID_PAYLOAD", message: firstError };
  }

  return { ok: true, values };
}
