import type { AssignmentOfferRow } from "@/lib/database/types";

type RequiredOfferKeys = Pick<AssignmentOfferRow, "id" | "booking_id" | "cleaner_id">;

/** Defaults for in-memory offer fixtures (team slot columns + timestamps). */
export function testAssignmentOfferRow(
  partial: Partial<AssignmentOfferRow> & RequiredOfferKeys,
): AssignmentOfferRow {
  const ts = partial.created_at ?? new Date().toISOString();
  return {
    status: "offered",
    team_role: "primary",
    roster_id: null,
    responded_at: null,
    expires_at: null,
    offered_at: ts,
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}
