import { z } from "zod";

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "idempotencyKey must be at least 8 characters.")
  .max(200);

export const authorizeMonthlyServiceBodySchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  monthlyAccountId: z.string().uuid("monthlyAccountId must be a valid UUID."),
  reason: z.string().trim().min(1, "reason is required.").max(500),
  idempotencyKey: idempotencyKeySchema,
  confirmMonthlyAccount: z.literal(true, {
    message: "confirmMonthlyAccount must be true to authorize service.",
  }),
  confirmElevatedExposure: z.literal(true).optional(),
});

export type AuthorizeMonthlyServiceBody = z.infer<typeof authorizeMonthlyServiceBodySchema>;

export type ParseAuthorizeMonthlyServiceBodyResult =
  | { ok: true; values: AuthorizeMonthlyServiceBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAuthorizeMonthlyServiceBody(
  body: unknown,
): ParseAuthorizeMonthlyServiceBodyResult {
  const parsed = authorizeMonthlyServiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}
