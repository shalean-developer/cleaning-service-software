import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NF-7C guardrails: schema/read-model only — assignment, payout, and lifecycle paths stay untouched.
 */
describe("NF-7C behavior safeguards (no dispatch/payout/lifecycle changes)", () => {
  const assignmentContext = readFileSync(
    path.join(process.cwd(), "src/features/assignments/server/assignmentContext.ts"),
    "utf8",
  );

  const executeBookingCommand = readFileSync(
    path.join(process.cwd(), "src/features/bookings/server/commands/executeBookingCommand.ts"),
    "utf8",
  );

  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260523120000_booking_cleaners_team_foundation.sql",
    ),
    "utf8",
  );

  it("defaults assignment context teamSize to 1 when team offers disabled", () => {
    expect(assignmentContext).toMatch(/dispatchTeamSizeFromQuoteInput/);
    expect(assignmentContext).toMatch(/if \(!isTeamOffersEnabled\(\)\) return 1/);
  });

  it("wires roster sync only behind team offers flag in command execution", () => {
    expect(executeBookingCommand).toMatch(/isTeamOffersEnabled/);
    expect(executeBookingCommand).toMatch(/syncRosterOnOffer/);
  });

  it("does not alter assignment_offers uniqueness or booking_apply_transition", () => {
    expect(migration).not.toMatch(/idx_assignment_offers_one_open_per_booking/i);
    expect(migration).not.toMatch(/booking_apply_transition/i);
    expect(migration).not.toMatch(/alter table public\.bookings/i);
  });
});
