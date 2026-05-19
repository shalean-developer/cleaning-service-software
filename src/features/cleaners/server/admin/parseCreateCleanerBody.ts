import "server-only";

import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SLUGS } from "@/features/pricing/server/types";
import {
  validateCleanerCreateForm,
  type CleanerCreateFormValues,
} from "@/features/cleaners/admin/cleanerProfileFormValidation";
import { findForbiddenLifecycleKeys } from "./profilePayloadGuards";

const VALID_SLUGS = new Set<string>(SERVICE_SLUGS);

export type ParsedCreateCleanerBody = CleanerCreateFormValues & {
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

export function parseCreateCleanerBody(
  body: unknown,
):
  | { ok: true; values: ParsedCreateCleanerBody }
  | { ok: false; code: string; message: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Request body must be JSON." };
  }

  const record = body as Record<string, unknown>;
  const forbidden = findForbiddenLifecycleKeys(record);
  if (forbidden.length > 0) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Lifecycle fields cannot be set during cleaner creation.",
    };
  }

  const values: ParsedCreateCleanerBody = {
    fullName: readString(record.fullName),
    phone: readString(record.phone),
    password: readString(record.password),
    confirmPassword: readString(record.confirmPassword),
    serviceAreasInput: readString(record.serviceAreasInput),
    capabilities: readCapabilities(record.capabilities),
    idempotencyKey:
      typeof record.idempotencyKey === "string" ? record.idempotencyKey : null,
  };

  const validation = validateCleanerCreateForm(values);
  if (!validation.valid) {
    const firstError =
      validation.errors.fullName ??
      validation.errors.phone ??
      validation.errors.password ??
      validation.errors.confirmPassword ??
      validation.errors.capabilities ??
      validation.errors.serviceAreasInput ??
      "Invalid cleaner profile payload.";
    return { ok: false, code: "INVALID_PAYLOAD", message: firstError };
  }

  if (!validation.generatedAuthEmail || !validation.phoneE164) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Enter a valid South African mobile number.",
    };
  }

  return { ok: true, values };
}
