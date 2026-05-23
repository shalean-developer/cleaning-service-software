import { z } from "zod";
import { ADMIN_OFFLINE_PAYMENT_RAILS } from "./adminOfflinePaymentTypes";

const baseSchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  amountCents: z.number().int().positive("amountCents must be a positive integer."),
  rail: z.enum(ADMIN_OFFLINE_PAYMENT_RAILS),
  receivedAt: z.string().trim().min(1, "receivedAt is required."),
  evidenceReference: z.string().trim().min(1, "evidenceReference is required.").max(200),
  reason: z.string().trim().min(1, "reason is required.").max(500),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters.")
    .max(200),
  bankReference: z.string().trim().max(200).optional(),
  terminalReference: z.string().trim().max(200).optional(),
  receiptNumber: z.string().trim().max(200).optional(),
  confirmSupersedesActivePaymentLink: z.boolean().optional(),
  sopConfirmed: z.literal(true, {
    message: "SOP reconciliation confirmation is required.",
  }),
});

export const adminRecordOfflinePaymentBodySchema = baseSchema.superRefine((data, ctx) => {
  if (data.rail === "eft" && !data.bankReference?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "bankReference is required for EFT.",
      path: ["bankReference"],
    });
  }
  if (data.rail === "card_machine" && !data.terminalReference?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "terminalReference is required for card machine.",
      path: ["terminalReference"],
    });
  }
  if (data.rail === "cash" && !data.receiptNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receiptNumber is required for cash.",
      path: ["receiptNumber"],
    });
  }
  const receivedMs = Date.parse(data.receivedAt);
  if (!Number.isFinite(receivedMs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receivedAt is invalid.",
      path: ["receivedAt"],
    });
    return;
  }
  if (receivedMs > Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receivedAt cannot be in the future.",
      path: ["receivedAt"],
    });
  }
});

export type AdminRecordOfflinePaymentBody = z.infer<typeof adminRecordOfflinePaymentBodySchema>;

export type ParseAdminRecordOfflinePaymentBodyResult =
  | { ok: true; values: AdminRecordOfflinePaymentBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAdminRecordOfflinePaymentBody(
  body: unknown,
): ParseAdminRecordOfflinePaymentBodyResult {
  const parsed = adminRecordOfflinePaymentBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}
