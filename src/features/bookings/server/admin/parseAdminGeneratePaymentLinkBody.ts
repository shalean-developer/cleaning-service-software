import { z } from "zod";

export const ADMIN_PAYMENT_LINK_DELIVERY_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "copy_only",
] as const;

export const adminGeneratePaymentLinkBodySchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters.")
    .max(200),
  deliveryChannel: z.enum(ADMIN_PAYMENT_LINK_DELIVERY_CHANNELS).optional().default("copy_only"),
  reason: z.string().trim().max(500).optional(),
  regenerate: z.boolean().optional().default(false),
});

export type AdminGeneratePaymentLinkBody = z.infer<typeof adminGeneratePaymentLinkBodySchema>;

export type ParseAdminGeneratePaymentLinkBodyResult =
  | { ok: true; values: AdminGeneratePaymentLinkBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAdminGeneratePaymentLinkBody(
  body: unknown,
): ParseAdminGeneratePaymentLinkBodyResult {
  const parsed = adminGeneratePaymentLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}
