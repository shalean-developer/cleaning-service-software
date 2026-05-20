import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("JobCompletionActions", () => {
  it("uses compact layout and loading affordances without changing API paths", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/JobCompletionActions.tsx"),
      "utf8",
    );
    expect(source).toContain("compact?: boolean");
    expect(source).toContain('aria-busy={loading === "start"}');
    expect(source).toContain("transition-[opacity,transform]");
    expect(source).toContain("/api/cleaner/jobs/${bookingId}/start");
    expect(source).toContain("/api/cleaner/jobs/${bookingId}/complete");
  });
});
