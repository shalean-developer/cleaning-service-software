import { describe, expect, it } from "vitest";
import {
  buildAdminSupportRequestHistory,
  buildCustomerSupportRequestHistory,
} from "./supportRequestHistory";

describe("supportRequestHistory", () => {
  it("customer history excludes admin notes", () => {
    const entries = buildCustomerSupportRequestHistory({
      createdAt: "2026-05-20T10:00:00.000Z",
      status: "resolved",
      statusChangedAt: "2026-05-21T10:00:00.000Z",
      respondedAt: "2026-05-21T10:00:00.000Z",
      resolvedAt: "2026-05-21T12:00:00.000Z",
      customerResponse: "We updated your booking.",
    });
    expect(entries.some((e) => e.label === "Submitted")).toBe(true);
    expect(entries.some((e) => e.detail?.includes("We updated"))).toBe(true);
    expect(entries.every((e) => !e.adminOnly)).toBe(true);
  });

  it("admin history includes internal notes", () => {
    const entries = buildAdminSupportRequestHistory({
      createdAt: "2026-05-20T10:00:00.000Z",
      updatedAt: "2026-05-21T12:00:00.000Z",
      status: "resolved",
      statusChangedAt: "2026-05-21T10:00:00.000Z",
      respondedAt: "2026-05-21T10:00:00.000Z",
      resolvedAt: "2026-05-21T12:00:00.000Z",
      resolvedBy: "admin-profile-1",
      customerResponse: "Done",
      adminNotes: "Called customer",
    });
    expect(entries.some((e) => e.key === "admin_notes")).toBe(true);
    expect(entries.some((e) => e.key === "resolved_by")).toBe(true);
  });
});
