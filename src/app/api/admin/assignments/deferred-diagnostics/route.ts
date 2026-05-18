import { NextResponse } from "next/server";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      { ok: false, error: "AUTH_NOT_CONFIGURED", message: "Supabase not configured." },
      { status: 503 },
    );
  }

  const config = getDeferredAssignmentConfig();
  const diagnostics = await getDeferredAssignmentDiagnostics(client, {
    deferredEnabled: config.enabled,
  });

  return NextResponse.json({ ok: true, diagnostics });
}
