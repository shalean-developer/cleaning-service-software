import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_ROOT = path.join(process.cwd(), "src/app/api/admin/monthly-billing");

function readRoute(relative: string): string {
  return readFileSync(path.join(ROUTE_ROOT, relative), "utf8");
}

describe("admin monthly billing API routes (read-only)", () => {
  const routes = [
    "accounts/route.ts",
    "accounts/[customerId]/route.ts",
    "batches/route.ts",
    "batches/[batchId]/route.ts",
  ];

  it.each(routes)("%s exports GET only", (routePath) => {
    const content = readRoute(routePath);
    expect(content).toMatch(/export async function GET/);
    expect(content).not.toMatch(/export async function POST/);
    expect(content).not.toMatch(/export async function PUT/);
    expect(content).not.toMatch(/export async function PATCH/);
    expect(content).not.toMatch(/export async function DELETE/);
    expect(content).toMatch(/requireApiUser\(\["admin"\]\)/);
  });
});
