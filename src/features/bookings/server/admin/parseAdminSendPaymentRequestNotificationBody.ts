import { z } from "zod";

export const ADMIN_PAYMENT_REQUEST_DELIVERY_CHANNELS = ["email", "whatsapp_copy"] as const;

export const adminSendPaymentRequestNotificationBodySchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters.")
    .max(200),
  deliveryChannel: z.enum(ADMIN_PAYMENT_REQUEST_DELIVERY_CHANNELS),
  message: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

export type AdminSendPaymentRequestNotificationBody = z.infer<
  typeof adminSendPaymentRequestNotificationBodySchema
>;

export type ParseAdminSendPaymentRequestNotificationBodyResult =
  | { ok: true; values: AdminSendPaymentRequestNotificationBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAdminSendPaymentRequestNotificationBody(
  body: unknown,
): ParseAdminSendPaymentRequestNotificationBodyResult {
  const parsed = adminSendPaymentRequestNotificationBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}
