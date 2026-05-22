import { z } from "zod";

const adminHardDeleteBodySchema = z.object({
  reason: z.string().min(1, "reason is required"),
  confirmPhrase: z.string().min(1, "confirmPhrase is required"),
  idempotencyKey: z.string().optional(),
});

export type ParsedAdminHardDeleteBody = z.infer<typeof adminHardDeleteBodySchema>;

export function parseAdminHardDeleteBody(body: unknown):
  | { ok: true; data: ParsedAdminHardDeleteBody }
  | { ok: false; message: string } {
  const parsed = adminHardDeleteBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid payload.";
    return { ok: false, message };
  }
  return { ok: true, data: parsed.data };
}

import { BOOKING_HARD_DELETE_CONFIRM_PHRASE } from "@/features/admin/adminEntityArchiveEligibility";

export { BOOKING_HARD_DELETE_CONFIRM_PHRASE };

export function validateBookingHardDeleteConfirmPhrase(phrase: string): string | null {
  if (phrase.trim() !== BOOKING_HARD_DELETE_CONFIRM_PHRASE) {
    return `Type ${BOOKING_HARD_DELETE_CONFIRM_PHRASE} to confirm.`;
  }
  return null;
}
