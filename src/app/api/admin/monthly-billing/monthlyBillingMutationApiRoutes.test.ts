import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MUTATION_ROUTES = [
  "accounts/[customerId]/enable/route.ts",
  "accounts/[customerId]/disable/route.ts",
  "accounts/[customerId]/terms/route.ts",
  "accounts/[customerId]/zoho-customer/route.ts",
];

function readRoute(relative: string): string {
  return readFileSync(
    path.join(process.cwd(), "src/app/api/admin/monthly-billing", relative),
    "utf8",
  );
}

describe("admin monthly billing mutation API routes", () => {
  it.each(MUTATION_ROUTES)("%s exports POST only", (routePath) => {
    const content = readRoute(routePath);
    expect(content).toMatch(/export async function POST/);
    expect(content).not.toMatch(/export async function GET/);
    expect(content).not.toMatch(/export async function PUT/);
    expect(content).not.toMatch(/export async function PATCH/);
    expect(content).not.toMatch(/export async function DELETE/);
    expect(content).toMatch(/requireApiUser\(\["admin"\]\)/);
  });
});
