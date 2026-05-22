import { z } from "zod";

const adminArchiveBodySchema = z.object({
  reason: z.string().min(1, "reason is required"),
  action: z.enum(["archive", "delete"]).optional(),
  idempotencyKey: z.string().optional(),
  confirmPhrase: z.string().optional(),
});

export type ParsedAdminArchiveBody = z.infer<typeof adminArchiveBodySchema>;

export function parseAdminArchiveBody(body: unknown):
  | { ok: true; data: ParsedAdminArchiveBody }
  | { ok: false; message: string } {
  const parsed = adminArchiveBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid payload.";
    return { ok: false, message };
  }
  return { ok: true, data: parsed.data };
}

export function validateConfirmPhrase(
  phrase: string | undefined,
  expected: string,
): string | null {
  if (phrase?.trim() !== expected) {
    return `Type ${expected} to confirm.`;
  }
  return null;
}
