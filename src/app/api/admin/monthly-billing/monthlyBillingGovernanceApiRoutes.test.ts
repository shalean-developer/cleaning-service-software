import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const POST_ROUTES = [
  "src/app/api/admin/monthly-billing/accounts/[customerId]/governance-state/route.ts",
  "src/app/api/admin/monthly-billing/accounts/[customerId]/credit-limit/route.ts",
  "src/app/api/admin/monthly-billing/accounts/[customerId]/temporary-override/route.ts",
];

describe("monthly billing governance API routes", () => {
  for (const route of POST_ROUTES) {
    it(`${route} is admin-only POST with confirmAction parsing`, () => {
      const source = readFileSync(path.join(process.cwd(), route), "utf8");
      expect(source).toMatch(/requireApiUser\(\["admin"\]\)/);
      expect(source).toMatch(/export async function POST/);
      expect(source).not.toMatch(/export async function PUT/);
    });
  }

  it("governance-state named GET dashboard loader", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/monthly-billing/governance/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/loadMonthlyGovernanceDashboard/);
    expect(source).toMatch(/export async function GET/);
  });

  it("governance-state route validates confirmAction schema", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/admin/monthly-billing/accounts/[customerId]/governance-state/route.ts",
      ),
      "utf8",
    );
    expect(source).toMatch(/parseUpdateMonthlyAccountGovernanceStateBody/);
    expect(source).toMatch(/updateMonthlyAccountGovernanceState/);
  });
});
