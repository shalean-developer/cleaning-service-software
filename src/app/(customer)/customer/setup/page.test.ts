import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CustomerSetupPage", () => {
  it("redirects ready customers away from setup", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/customer/setup/page.tsx"),
      "utf8",
    );
    expect(source).toContain('readiness.status === "ready"');
    expect(source).toContain("resolvePostSignInPath");
  });

  it("redirects wrong roles to their home dashboard", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/customer/setup/page.tsx"),
      "utf8",
    );
    expect(source).toContain('readiness.status === "wrong_role"');
    expect(source).toContain("homePathForRole");
  });

  it("calls ensure_customer_provisioned from server action", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(customer)/customer/setup/actions.ts"),
      "utf8",
    );
    expect(source).toContain('rpc("ensure_customer_provisioned"');
    expect(source).toContain('readiness.status === "wrong_role"');
  });
});
