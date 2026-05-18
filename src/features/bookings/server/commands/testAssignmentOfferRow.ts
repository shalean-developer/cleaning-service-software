import type { AssignmentOfferRow } from "@/lib/database/types";

/** Defaults for in-memory offer fixtures (NF-7D slot columns). */
export function testAssignmentOfferRow(
  partial: Omit<AssignmentOfferRow, "team_role" | "roster_id"> &
    Partial<Pick<AssignmentOfferRow, "team_role" | "roster_id">>,
): AssignmentOfferRow {
  return {
    team_role: "primary",
    roster_id: null,
    ...partial,
  };
}
