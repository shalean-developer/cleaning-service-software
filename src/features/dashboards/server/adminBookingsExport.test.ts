import { describe, expect, it } from "vitest";
import type { AdminBookingListItem } from "./types";
import {
  ADMIN_BOOKINGS_EXPORT_LIMIT,
  assertCsvExcludesSensitivePatterns,
  buildBookingsExportFilename,
  escapeCsvCell,
  formatCsvRow,
  mapAdminBookingListItemToCsvRow,
  renderAdminBookingsCsv,
} from "./adminBookingsExport";

function sampleListItem(overrides: Partial<AdminBookingListItem> = {}): AdminBookingListItem {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "pending_assignment",
    paymentStatus: "paid",
    paymentFailureReason: null,
    customerLabel: "Acme Holdings",
    cleanerLabel: null,
    serviceLabel: "Deep clean",
    scheduleLabel: "Mon 9:00",
    scheduledStart: "2026-05-20T08:00:00.000Z",
    scheduledEnd: "2026-05-20T10:00:00.000Z",
    createdAt: "2026-05-16T10:00:00.000Z",
    suburb: "Sandton",
    city: "Johannesburg",
    priceLabel: "R 500.00",
    assignmentAttention: "needs_assignment",
    assignmentVisibilityKey: "needs_assignment",
    latestProviderRef: "paystack_tx_abc",
    updatedAt: "2026-05-17T12:00:00.000Z",
    ...overrides,
  };
}

describe("adminBookingsExport", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsvCell("Acme, Inc")).toBe('"Acme, Inc"');
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("prefixes formula injection characters", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+123")).toBe("'+123");
    expect(escapeCsvCell("-123")).toBe("'-123");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("maps allowlisted columns from list items", () => {
    const row = mapAdminBookingListItemToCsvRow(sampleListItem());
    expect(row.booking_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(row.booking_reference).toBe("550e8400");
    expect(row.status).toBe("pending_assignment");
    expect(row.customer_name).toBe("Acme Holdings");
    expect(row.suburb).toBe("Sandton");
    expect(row.provider_ref).toBe("paystack_tx_abc");
    expect(row).not.toHaveProperty("metadata");
    expect(row).not.toHaveProperty("email");
  });

  it("renders header row and truncation comment", () => {
    const csv = renderAdminBookingsCsv([mapAdminBookingListItemToCsvRow(sampleListItem())], {
      truncated: true,
      returnedCount: 500,
      matchTotal: 1200,
    });
    expect(csv).toContain("# Exported 500 of 1200 matching bookings");
    expect(csv).toContain("booking_id,booking_reference,status");
    expect(() => assertCsvExcludesSensitivePatterns(csv)).not.toThrow();
  });

  it("builds export filename with scope and timestamp", () => {
    const name = buildBookingsExportFilename(
      "payment-failed",
      new Date("2026-05-17T14:30:22.000Z"),
    );
    expect(name).toMatch(/^bookings-export-payment-failed-20260517T143022Z\.csv$/);
  });

  it("formatCsvRow joins escaped cells", () => {
    expect(formatCsvRow(["a", "b,c", "=x"])).toBe(`a,"b,c",'=x`);
  });

  it("export cap constant is 500", () => {
    expect(ADMIN_BOOKINGS_EXPORT_LIMIT).toBe(500);
  });
});
