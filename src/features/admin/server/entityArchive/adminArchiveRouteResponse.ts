import { NextResponse } from "next/server";
import type { AdminArchiveCommandResult } from "./types";
import { mapAdminArchiveHttpStatus } from "./adminArchiveSupport";

export function adminArchiveRouteResponse(result: AdminArchiveCommandResult) {
  const status = mapAdminArchiveHttpStatus(result);
  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        outcome: result.outcome,
        entityType: result.entityType,
        entityId: result.entityId,
        auditId: result.auditId,
        message: result.message,
        affectedCounts: result.affectedCounts ?? null,
        idempotent: result.outcome === "idempotent",
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: result.code,
      message: result.message,
      outcome: result.outcome,
      entityType: result.entityType,
      entityId: result.entityId,
      auditId: result.auditId,
      blockedReason: result.blockedReason ?? null,
      affectedCounts: result.affectedCounts ?? null,
    },
    { status },
  );
}
