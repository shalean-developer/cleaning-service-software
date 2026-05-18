import "server-only";

import { NextResponse } from "next/server";
import type { CurrentUser } from "@/lib/auth/types";
import type { CleanerLifecycleCommandResult } from "../lifecycle/types";
import { mapCleanerLifecycleHttpStatus } from "./mapCleanerLifecycleHttpStatus";

export type CleanerLifecycleRouteBody = {
  reason?: unknown;
  suspensionEndsAt?: unknown;
  idempotencyKey?: unknown;
  setActive?: unknown;
};

export function parseLifecycleRouteBody(body: unknown): CleanerLifecycleRouteBody {
  if (body === null || typeof body !== "object") return {};
  return body as CleanerLifecycleRouteBody;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function lifecycleCommandJsonResponse(result: CleanerLifecycleCommandResult) {
  const status = mapCleanerLifecycleHttpStatus(result);
  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        outcome: result.outcome,
        cleanerId: result.cleanerId,
        auditId: result.auditId,
        message: result.message,
        affectedCounts: result.affectedCounts,
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
      cleanerId: result.cleanerId,
      auditId: result.auditId,
      affectedCounts: result.affectedCounts ?? null,
    },
    { status },
  );
}

export function buildLifecycleBaseParams(
  user: CurrentUser,
  cleanerId: string,
  body: CleanerLifecycleRouteBody,
) {
  return {
    cleanerId,
    adminProfileId: user.profileId,
    idempotencyKey: readOptionalString(body.idempotencyKey) ?? null,
  };
}
