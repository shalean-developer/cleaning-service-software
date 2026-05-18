import { describe, expect, it, vi } from "vitest";
import type { BookingCleanerRow } from "@/lib/database/types";
import {
  formatTeamRosterFoundationSummary,
  labelForBookingCleanerRole,
  labelForBookingCleanerStatus,
  listTeamRosterFoundationForBooking,
  mapBookingCleanerToDisplayRow,
} from "./bookingCleanersReadModel";

function rosterRow(
  overrides: Partial<BookingCleanerRow> & Pick<BookingCleanerRow, "id" | "role" | "status">,
): BookingCleanerRow {
  return {
    id: overrides.id,
    booking_id: overrides.booking_id ?? "booking-1",
    cleaner_id: overrides.cleaner_id ?? "cleaner-1",
    role: overrides.role,
    status: overrides.status,
    assigned_by_profile_id: overrides.assigned_by_profile_id ?? null,
    support_completed_at: overrides.support_completed_at ?? null,
    support_note: overrides.support_note ?? null,
    created_at: overrides.created_at ?? "2026-05-23T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-05-23T10:00:00.000Z",
  };
}

describe("bookingCleanersReadModel (NF-7C)", () => {
  it("labels primary and support roles", () => {
    expect(labelForBookingCleanerRole("primary")).toBe("Primary");
    expect(labelForBookingCleanerRole("support")).toBe("Support");
  });

  it("labels roster statuses", () => {
    expect(labelForBookingCleanerStatus("planned")).toBe("Planned");
    expect(labelForBookingCleanerStatus("accepted")).toBe("Accepted");
  });

  it("maps primary and support rows for display", () => {
    const labels = new Map([
      ["cleaner-a", "Alice"],
      ["cleaner-b", "Bob"],
    ]);
    const primary = mapBookingCleanerToDisplayRow(
      rosterRow({ id: "bc-1", role: "primary", status: "planned", cleaner_id: "cleaner-a" }),
      labels,
    );
    const support = mapBookingCleanerToDisplayRow(
      rosterRow({ id: "bc-2", role: "support", status: "planned", cleaner_id: "cleaner-b" }),
      labels,
    );
    expect(primary.roleLabel).toBe("Primary");
    expect(primary.cleanerLabel).toBe("Alice");
    expect(support.roleLabel).toBe("Support");
    expect(support.cleanerLabel).toBe("Bob");
    expect(support.supportCompletedAt).toBeNull();
    expect(support.supportNote).toBeNull();
  });

  it("maps NF-7F support participation fields", () => {
    const row = mapBookingCleanerToDisplayRow(
      rosterRow({
        id: "bc-2",
        role: "support",
        status: "completed",
        cleaner_id: "cleaner-b",
        support_completed_at: "2026-05-25T12:00:00.000Z",
        support_note: "Helped with kitchen",
      }),
      new Map([["cleaner-b", "Bob"]]),
    );
    expect(row.supportCompletedAt).toBe("2026-05-25T12:00:00.000Z");
    expect(row.supportNote).toBe("Helped with kitchen");
  });

  it("returns empty list when client is null (single-cleaner bookings unchanged)", async () => {
    const rows = await listTeamRosterFoundationForBooking(null, "booking-1");
    expect(rows).toEqual([]);
  });

  it("returns empty list when no roster rows exist", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    const rows = await listTeamRosterFoundationForBooking(
      client as never,
      "booking-legacy",
    );
    expect(rows).toEqual([]);
  });

  it("formats roster summary for admin diagnostics", () => {
    const summary = formatTeamRosterFoundationSummary([
      mapBookingCleanerToDisplayRow(
        rosterRow({ id: "bc-1", role: "primary", status: "accepted", cleaner_id: "c1" }),
        new Map([["c1", "Alice"]]),
      ),
      mapBookingCleanerToDisplayRow(
        rosterRow({ id: "bc-2", role: "support", status: "planned", cleaner_id: "c2" }),
        new Map([["c2", "Bob"]]),
      ),
    ]);
    expect(summary).toContain("Primary: Alice");
    expect(summary).toContain("1 support");
  });
});
