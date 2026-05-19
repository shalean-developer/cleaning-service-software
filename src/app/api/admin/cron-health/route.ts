import { NextResponse } from "next/server";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read-only cron health for Regular Cleaning launch ops (no secrets).
 * GET — admin session required.
 */
export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_NOT_CONFIGURED",
        message: "Database client not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const health = await loadCronHealthReadModel(client);
    return NextResponse.json({ ok: true, ...health });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load cron health.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}
