import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("AdminSupportInboxToolbar", () => {
  it("defines inbox filters including urgent and source tabs", () => {
    const source = readFileSync(
      "src/components/dashboard/admin/support/AdminSupportInboxToolbar.tsx",
      "utf8",
    );
    expect(source).toContain('"urgent"');
    expect(source).toContain('"booking"');
    expect(source).toContain('"recurring"');
    expect(source).toContain("/admin/support");
  });
});
