import { z } from "zod";

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "idempotencyKey must be at least 8 characters.")
  .max(200);

export const enableMonthlyBillingBodySchema = z
  .object({
    billingEmail: z.string().trim().email("billingEmail must be a valid email."),
    billingTerms: z.string().trim().min(1, "billingTerms is required.").max(500),
    approvalReason: z.string().trim().min(1, "approvalReason is required.").max(500),
    idempotencyKey: idempotencyKeySchema,
    zohoCustomerId: z.string().trim().min(3).max(200).optional(),
    createZohoCustomer: z.boolean().optional(),
    monthEndBillingConfirmed: z.literal(true, {
      message: "Month-end billing approval confirmation is required.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.createZohoCustomer && data.zohoCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either zohoCustomerId or createZohoCustomer, not both.",
        path: ["createZohoCustomer"],
      });
    }
  });

export const disableMonthlyBillingBodySchema = z.object({
  reason: z.string().trim().min(1, "reason is required.").max(500),
  idempotencyKey: idempotencyKeySchema,
});

export const updateMonthlyBillingTermsBodySchema = z.object({
  billingEmail: z.string().trim().email("billingEmail must be a valid email."),
  billingTerms: z.string().trim().min(1, "billingTerms is required.").max(500),
  reason: z.string().trim().min(1, "reason is required.").max(500),
  idempotencyKey: idempotencyKeySchema,
});

export const linkZohoCustomerBodySchema = z.object({
  zohoCustomerId: z.string().trim().min(3, "zohoCustomerId is required.").max(200),
  reason: z.string().trim().min(1, "reason is required.").max(500),
  idempotencyKey: idempotencyKeySchema,
});

export const generateZohoMonthlyInvoiceBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmReviewed: z.literal(true, {
    message: "Batch review confirmation is required.",
  }),
});

export type EnableMonthlyBillingBody = z.infer<typeof enableMonthlyBillingBodySchema>;
export type DisableMonthlyBillingBody = z.infer<typeof disableMonthlyBillingBodySchema>;
export type UpdateMonthlyBillingTermsBody = z.infer<typeof updateMonthlyBillingTermsBodySchema>;
export type LinkZohoCustomerBody = z.infer<typeof linkZohoCustomerBodySchema>;
export type GenerateZohoMonthlyInvoiceBody = z.infer<typeof generateZohoMonthlyInvoiceBodySchema>;

export type ParseMonthlyBillingBodyResult<T> =
  | { ok: true; values: T }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): ParseMonthlyBillingBodyResult<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, values: parsed.data };
}

export const parseEnableMonthlyBillingBody = (body: unknown) =>
  parseBody(enableMonthlyBillingBodySchema, body);
export const parseDisableMonthlyBillingBody = (body: unknown) =>
  parseBody(disableMonthlyBillingBodySchema, body);
export const parseUpdateMonthlyBillingTermsBody = (body: unknown) =>
  parseBody(updateMonthlyBillingTermsBodySchema, body);
export const parseLinkZohoCustomerBody = (body: unknown) =>
  parseBody(linkZohoCustomerBodySchema, body);
export const parseGenerateZohoMonthlyInvoiceBody = (body: unknown) =>
  parseBody(generateZohoMonthlyInvoiceBodySchema, body);

export const syncMonthlyInvoicePaymentStatusBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmSync: z.literal(true, {
    message: "Payment sync confirmation is required.",
  }),
});

export type SyncMonthlyInvoicePaymentStatusBody = z.infer<
  typeof syncMonthlyInvoicePaymentStatusBodySchema
>;

export const parseSyncMonthlyInvoicePaymentStatusBody = (body: unknown) =>
  parseBody(syncMonthlyInvoicePaymentStatusBodySchema, body);

export const sendMonthlyInvoiceBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmSend: z.literal(true, {
    message: "Send invoice confirmation is required.",
  }),
});

export const sendMonthlyInvoiceReminderBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmReminder: z.literal(true, {
    message: "Send reminder confirmation is required.",
  }),
});

export const markMonthlyInvoiceOverdueBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmOverdue: z.literal(true, {
    message: "Mark overdue confirmation is required.",
  }),
  force: z.boolean().optional(),
});

export type SendMonthlyInvoiceBody = z.infer<typeof sendMonthlyInvoiceBodySchema>;
export type SendMonthlyInvoiceReminderBody = z.infer<typeof sendMonthlyInvoiceReminderBodySchema>;
export type MarkMonthlyInvoiceOverdueBody = z.infer<typeof markMonthlyInvoiceOverdueBodySchema>;

export const parseSendMonthlyInvoiceBody = (body: unknown) =>
  parseBody(sendMonthlyInvoiceBodySchema, body);
export const parseSendMonthlyInvoiceReminderBody = (body: unknown) =>
  parseBody(sendMonthlyInvoiceReminderBodySchema, body);
export const parseMarkMonthlyInvoiceOverdueBody = (body: unknown) =>
  parseBody(markMonthlyInvoiceOverdueBodySchema, body);

export const resendMonthlyInvoiceBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmResend: z.literal(true, { message: "Resend confirmation is required." }),
});

export const markMonthlyInvoiceFinanceReviewBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmFinanceReview: z.literal(true, {
    message: "Finance review confirmation is required.",
  }),
});

export const markMonthlyInvoiceDisputedBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().max(500).optional(),
  confirmDisputed: z.literal(true, { message: "Dispute confirmation is required." }),
});

export const parseResendMonthlyInvoiceBody = (body: unknown) =>
  parseBody(resendMonthlyInvoiceBodySchema, body);
export const parseMarkMonthlyInvoiceFinanceReviewBody = (body: unknown) =>
  parseBody(markMonthlyInvoiceFinanceReviewBodySchema, body);
export const parseMarkMonthlyInvoiceDisputedBody = (body: unknown) =>
  parseBody(markMonthlyInvoiceDisputedBodySchema, body);

export const updateMonthlyAccountGovernanceStateBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1, "reason is required.").max(500),
  confirmAction: z.literal(true, { message: "confirmAction must be true." }),
  governanceState: z.enum([
    "approved",
    "account_review_required",
    "finance_hold",
    "disputed",
    "suspended",
  ]),
});

export const updateMonthlyAccountCreditLimitBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1, "reason is required.").max(500),
  confirmAction: z.literal(true, { message: "confirmAction must be true." }),
  creditLimitCents: z.number().int().min(0).nullable(),
});

export const grantMonthlyAccountTemporaryOverrideBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1, "reason is required.").max(500),
  confirmAction: z.literal(true, { message: "confirmAction must be true." }),
  manualOverrideUntil: z.string().trim().min(1, "manualOverrideUntil is required."),
});

export type UpdateMonthlyAccountGovernanceStateBody = z.infer<
  typeof updateMonthlyAccountGovernanceStateBodySchema
>;
export type UpdateMonthlyAccountCreditLimitBody = z.infer<
  typeof updateMonthlyAccountCreditLimitBodySchema
>;
export type GrantMonthlyAccountTemporaryOverrideBody = z.infer<
  typeof grantMonthlyAccountTemporaryOverrideBodySchema
>;

export const parseUpdateMonthlyAccountGovernanceStateBody = (body: unknown) =>
  parseBody(updateMonthlyAccountGovernanceStateBodySchema, body);
export const parseUpdateMonthlyAccountCreditLimitBody = (body: unknown) =>
  parseBody(updateMonthlyAccountCreditLimitBodySchema, body);
export const parseGrantMonthlyAccountTemporaryOverrideBody = (body: unknown) =>
  parseBody(grantMonthlyAccountTemporaryOverrideBodySchema, body);

export const updateMonthlyAccountFinanceReviewBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1, "reason is required.").max(500),
  confirmAction: z.literal(true, { message: "confirmAction must be true." }),
  reviewOwnerAdminId: z.string().uuid().nullable().optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followUpDate must be YYYY-MM-DD.")
    .nullable()
    .optional(),
  reviewStatus: z.enum(["open", "resolved", "dismissed"]).optional(),
  resolution: z.string().trim().max(2000).nullable().optional(),
});

export const monthlyGovernanceBulkActionBodySchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1, "reason is required.").max(500),
  confirmAction: z.literal(true, { message: "confirmAction must be true." }),
  action: z.enum(["mark_finance_review", "add_note", "assign_review_owner"]),
  customerIds: z.array(z.string().uuid()).min(1).max(50),
  reviewOwnerAdminId: z.string().uuid().nullable().optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  noteContent: z.string().trim().max(4000).optional(),
});

export type UpdateMonthlyAccountFinanceReviewBody = z.infer<
  typeof updateMonthlyAccountFinanceReviewBodySchema
>;
export type MonthlyGovernanceBulkActionBody = z.infer<typeof monthlyGovernanceBulkActionBodySchema>;

export const parseUpdateMonthlyAccountFinanceReviewBody = (body: unknown) =>
  parseBody(updateMonthlyAccountFinanceReviewBodySchema, body);
export const parseMonthlyGovernanceBulkActionBody = (body: unknown) =>
  parseBody(monthlyGovernanceBulkActionBodySchema, body);
