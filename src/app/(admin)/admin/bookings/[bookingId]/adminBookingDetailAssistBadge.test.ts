import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin booking detail assist badge", () => {
  it("shows admin-assisted badges for draft and pending_payment", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("adminAssistedDraft");
    expect(source).toContain("Admin-assisted draft");
    expect(source).toContain("Admin-assisted pending payment");
    expect(source).toContain("pending_payment");
  });
});
