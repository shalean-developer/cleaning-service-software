import "server-only";

import { z } from "zod";

const createCustomerBodySchema = z
  .object({
    email: z.string().trim().optional(),
    full_name: z
      .string()
      .trim()
      .min(1, "Full name is required.")
      .max(200, "Full name is too long."),
    company_name: z.string().trim().max(200, "Company name is too long.").optional(),
    phone: z.string().trim().optional(),
    notes: z.string().trim().max(2000, "Notes are too long.").optional(),
    send_invite: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim() ?? "";
    const phone = data.phone?.trim() ?? "";
    if (!email && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email or phone is required.",
        path: ["email"],
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address.",
        path: ["email"],
      });
    }
  });

export type ParsedCreateCustomerBody = z.infer<typeof createCustomerBodySchema>;

export function parseCreateCustomerBody(
  body: unknown,
):
  | { ok: true; values: ParsedCreateCustomerBody }
  | { ok: false; code: string; message: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Request body must be JSON." };
  }

  const parsed = createCustomerBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    return { ok: false, code: "INVALID_PAYLOAD", message };
  }

  return { ok: true, values: parsed.data };
}

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}
