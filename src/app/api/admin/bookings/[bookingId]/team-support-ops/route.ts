import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { recordAdminTeamSupportOps } from "@/features/dashboards/server/recordAdminTeamSupportOps";
import type { TeamCoordinationStatus } from "@/features/dashboards/server/adminTeamSupportObservation";

type RouteContext = { params: Promise<{ bookingId: string }> };

const COORDINATION_STATUSES = new Set<TeamCoordinationStatus>([
  "awaiting_coordination",
  "partially_fulfilled",
  "fully_coordinated",
]);

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be an object." },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  const input: Parameters<typeof recordAdminTeamSupportOps>[2] = {};

  if ("supportingCleaner" in record) {
    const raw = record.supportingCleaner;
    if (raw === null) {
      input.supportingCleaner = null;
    } else if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
      const sc = raw as { name?: unknown; profileId?: unknown };
      input.supportingCleaner = {
        name: typeof sc.name === "string" ? sc.name : undefined,
        profileId: typeof sc.profileId === "string" ? sc.profileId : undefined,
      };
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PAYLOAD",
          message: "supportingCleaner must be an object or null.",
        },
        { status: 400 },
      );
    }
  }

  if ("teamSupportNotes" in record) {
    const notes = record.teamSupportNotes;
    if (notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PAYLOAD",
          message: "teamSupportNotes must be a string or null.",
        },
        { status: 400 },
      );
    }
    input.teamSupportNotes = notes;
  }

  if ("coordinationStatus" in record) {
    const status = record.coordinationStatus;
    if (status === null) {
      input.coordinationStatus = null;
    } else if (typeof status === "string" && COORDINATION_STATUSES.has(status as TeamCoordinationStatus)) {
      input.coordinationStatus = status as TeamCoordinationStatus;
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PAYLOAD",
          message: "coordinationStatus must be awaiting_coordination, partially_fulfilled, fully_coordinated, or null.",
        },
        { status: 400 },
      );
    }
  }

  const result = await recordAdminTeamSupportOps(user, bookingId, input);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({ ok: true, teamSupportOps: result.teamSupportOps });
}
