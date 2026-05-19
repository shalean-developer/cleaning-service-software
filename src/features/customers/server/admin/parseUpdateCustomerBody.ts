import "server-only";

import { z } from "zod";
import { findForbiddenCustomerEditKeys } from "./customerPayloadGuards";

const updateCustomerBodySchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, "Company name cannot be empty.")
      .max(200, "Company name is too long.")
      .optional(),
    phone: z.union([z.string(), z.null()]).optional(),
    notes: z.union([z.string().max(2000, "Notes are too long."), z.null()]).optional(),
  })
  .strict();

export type ParsedUpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>;

export type NormalizedUpdateCustomerPatch = {
  companyName?: string;
  phone?: string | null;
  notes?: string | null;
};

export function parseUpdateCustomerBody(
  body: unknown,
):
  | { ok: true; patch: NormalizedUpdateCustomerPatch }
  | { ok: false; code: string; message: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Request body must be JSON." };
  }

  const record = body as Record<string, unknown>;
  const forbidden = findForbiddenCustomerEditKeys(record);
  if (forbidden.length > 0) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: `Unknown or forbidden field(s): ${forbidden.join(", ")}.`,
    };
  }

  const parsed = updateCustomerBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    return { ok: false, code: "INVALID_PAYLOAD", message };
  }

  const { company_name, phone, notes } = parsed.data;
  if (company_name === undefined && phone === undefined && notes === undefined) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "At least one editable field is required.",
    };
  }

  const patch: NormalizedUpdateCustomerPatch = {};
  if (company_name !== undefined) patch.companyName = company_name;
  if (phone !== undefined) {
    patch.phone = typeof phone === "string" ? phone.trim() || null : null;
  }
  if (notes !== undefined) {
    patch.notes = typeof notes === "string" ? notes.trim() || null : null;
  }

  return { ok: true, patch };
}
