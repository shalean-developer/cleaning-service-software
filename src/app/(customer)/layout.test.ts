import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CustomerLayout readiness gate", () => {
  it("skips readiness redirect on /customer/setup", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/layout.tsx"),
      "utf8",
    );
    expect(source).toContain("CUSTOMER_SETUP_PATH");
    expect(source).toContain("requireCustomerReadyForPath");
    expect(source).toMatch(/startsWith\(CUSTOMER_SETUP_PATH\)/);
  });
});
