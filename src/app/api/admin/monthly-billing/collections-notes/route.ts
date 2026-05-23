import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { createMonthlyAccountCollectionsNote } from "@/features/monthly-billing/server/monthlyAccountCollectionsNotesRepository";
import { MONTHLY_ACCOUNT_COLLECTIONS_NOTE_TYPES } from "@/lib/database/types";

const bodySchema = z.object({
  customerId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  noteType: z.enum(MONTHLY_ACCOUNT_COLLECTIONS_NOTE_TYPES),
  content: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const note = await createMonthlyAccountCollectionsNote({
      customerId: parsed.data.customerId,
      batchId: parsed.data.batchId ?? null,
      adminProfileId: user.profileId,
      noteType: parsed.data.noteType,
      content: parsed.data.content,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ ok: true, note });
  } catch {
    return NextResponse.json(
      { ok: false, error: "PERSISTENCE_ERROR", message: "Could not save collections note." },
      { status: 500 },
    );
  }
}
