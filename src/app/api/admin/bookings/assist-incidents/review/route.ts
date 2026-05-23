import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { upsertAdminAssistedIncidentReview } from "@/features/bookings/server/admin/adminAssistedIncidentReviewRepository";
import type { AdminAssistedIncidentReviewStatus } from "@/features/bookings/server/admin/adminAssistedIncidentReviewTypes";
import { loadAdminAssistedProductionStatus } from "@/features/bookings/server/admin/loadAdminAssistedProductionStatus";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

const VALID_STATUSES = new Set<AdminAssistedIncidentReviewStatus>([
  "open",
  "investigating",
  "resolved",
  "dismissed",
]);

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

  const payloadRecord =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const incidentKeyRaw = payloadRecord.incidentKey;
  const incidentKey = typeof incidentKeyRaw === "string" ? incidentKeyRaw.trim() : "";
  const status = payloadRecord.status;

  if (!incidentKey) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "incidentKey is required." },
      { status: 400 },
    );
  }

  if (typeof status !== "string" || !VALID_STATUSES.has(status as AdminAssistedIncidentReviewStatus)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "status must be open, investigating, resolved, or dismissed." },
      { status: 400 },
    );
  }

  const rootCauseNotes =
    typeof payloadRecord.rootCauseNotes === "string" ? payloadRecord.rootCauseNotes : null;
  const resolutionNotes =
    typeof payloadRecord.resolutionNotes === "string" ? payloadRecord.resolutionNotes : null;
  const followUpAction =
    typeof payloadRecord.followUpAction === "string" ? payloadRecord.followUpAction : null;

  try {
    const client = requireServiceRoleClient();
    const production = await loadAdminAssistedProductionStatus(client);
    const incident = production.activeIncidents.find((item) => item.id === incidentKey);

    if (!incident) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "Incident not found in current scan window." },
        { status: 404 },
      );
    }

    const review = await upsertAdminAssistedIncidentReview({
      incident,
      status: status as AdminAssistedIncidentReviewStatus,
      adminProfileId: user.profileId,
      rootCauseNotes,
      resolutionNotes,
      followUpAction,
      client,
    });

    return NextResponse.json({ ok: true, review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save incident review.";
    return NextResponse.json({ ok: false, error: "SAVE_FAILED", message }, { status: 500 });
  }
}
