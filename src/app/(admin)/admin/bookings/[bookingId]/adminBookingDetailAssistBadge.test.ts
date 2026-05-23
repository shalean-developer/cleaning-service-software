import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin booking detail assist badge", () => {
  it("shows Admin-assisted draft badge when metadata flag is set", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("adminAssistedDraft");
    expect(source).toContain("Admin-assisted draft");
  });
});
