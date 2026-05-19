import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static wiring guard: booking detail must mount the operational panel (Stage 6D-1).
 * Eligibility and actions are tested on AdminOperationalStatusPanel and show* helpers.
 */
describe("admin booking detail operational panel wiring", () => {
  it("mounts AdminOperationalStatusPanel with operational read-model prop", () => {
    const pagePath = path.join(
      process.cwd(),
      "src/app/(admin)/admin/bookings/[bookingId]/page.tsx",
    );
    const source = readFileSync(pagePath, "utf8");

    expect(source).toContain("AdminOperationalStatusPanel");
    expect(source).toContain("AdminBookingOperationalSummary");
    expect(source).toContain("operational={b.operational}");
    expect(source).toContain("bookingId={b.id}");
  });
});
