import { z } from "zod";

export const adminCreatePendingPaymentBodySchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters.")
    .max(200),
  reason: z.string().trim().max(500).optional(),
});

export type AdminCreatePendingPaymentBody = z.infer<typeof adminCreatePendingPaymentBodySchema>;

export type ParseAdminCreatePendingPaymentBodyResult =
  | { ok: true; values: AdminCreatePendingPaymentBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAdminCreatePendingPaymentBody(
  body: unknown,
): ParseAdminCreatePendingPaymentBodyResult {
  const parsed = adminCreatePendingPaymentBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}

export function adminAssistPaymentIdempotencyKey(idempotencyKey: string): string {
  return `admin-assist-pending:${idempotencyKey.trim()}`;
}
