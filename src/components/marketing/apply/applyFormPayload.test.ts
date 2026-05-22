import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCleanerIdentityEmail } from "@/features/cleaners/cleanerIdentity";

describe("CleanerApplyForm submit payload", () => {
  it("includes generated identity email when phone is valid", () => {
    expect(buildCleanerIdentityEmail("082 123 4567")).toBe("0821234567@shalean.co.za");
  });

  it("omits email from payload when phone is invalid", () => {
    expect(buildCleanerIdentityEmail("0111234567")).toBeNull();
  });

  it("form source derives email via buildCleanerIdentityEmail only", () => {
    const formPath = path.join(
      process.cwd(),
      "src/components/marketing/apply/CleanerApplyForm.tsx",
    );
    const source = readFileSync(formPath, "utf8");
    expect(source).toContain("buildCleanerIdentityEmail(phone)");
    expect(source).not.toContain("values.email");
  });
});
