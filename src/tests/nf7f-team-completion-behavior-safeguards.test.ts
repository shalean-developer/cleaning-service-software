import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NF-7F guardrails: roster-only support participation — no payout/lifecycle/dispatch changes.
 */
describe("NF-7F behavior safeguards", () => {
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260525120000_booking_cleaners_team_completion_nf7f.sql",
    ),
    "utf8",
  );

  const supportActions = readFileSync(
    path.join(process.cwd(), "src/features/bookings/server/supportParticipationActions.ts"),
    "utf8",
  );

  const completionActions = readFileSync(
    path.join(process.cwd(), "src/features/earnings/server/completionActions.ts"),
    "utf8",
  );

  const recordEarnings = readFileSync(
    path.join(process.cwd(), "src/features/earnings/server/recordEarningsForBooking.ts"),
    "utf8",
  );

  it("support participation updates roster only (no booking commands)", () => {
    expect(supportActions).not.toMatch(/executeBookingCommand/);
    expect(supportActions).not.toMatch(/type:\s*["']MARK_BOOKING_COMPLETED["']/);
    expect(supportActions).toMatch(/from\("booking_cleaners"\)/);
    expect(supportActions).toMatch(/status: "completed"/);
  });

  it("lead lifecycle actions guard against support cleaners when team offers enabled", () => {
    expect(completionActions).toMatch(/assertLeadCleanerForLifecycle/);
    expect(completionActions).toMatch(/Support cleaners cannot start or complete/);
  });

  it("migration does not touch payout or booking command layer", () => {
    expect(migration).not.toMatch(/earning_lines/i);
    expect(migration).not.toMatch(/booking_apply_transition/i);
    expect(migration).not.toMatch(/alter table public\.bookings/i);
  });

  it("recordEarningsForBooking does not invoke booking lifecycle commands (NF-7F)", () => {
    expect(recordEarnings).not.toMatch(/executeBookingCommand/);
    expect(recordEarnings).toMatch(/PRIMARY_COMPLETION_LINE_TYPE/);
  });
});
