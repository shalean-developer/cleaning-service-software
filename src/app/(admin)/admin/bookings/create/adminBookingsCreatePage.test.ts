import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("/admin/bookings/create (Phase 1)", () => {
  it("page uses admin layout guard via parent layout and renders wizard", () => {
    const layout = readSource("src/app/(admin)/layout.tsx");
    expect(layout).toContain('requireProfileRole(["admin"])');

    const page = readSource("src/app/(admin)/admin/bookings/create/page.tsx");
    expect(page).toContain("AdminBookingWizard");
    expect(page).toContain("isAdminAssistedBookingEnabled");
    expect(page).not.toContain("executeBookingCommand");
    expect(page).not.toContain("finalizePaidBooking");
  });

  it("exposes POST /api/admin/bookings/draft but not full POST /api/admin/bookings", () => {
    const listRoute = readSource("src/app/api/admin/bookings/route.ts");
    expect(listRoute).toContain("export async function GET");
    expect(listRoute).not.toContain("export async function POST");

    const draftRoute = readSource("src/app/api/admin/bookings/draft/route.ts");
    expect(draftRoute).toContain("export async function POST");
    expect(draftRoute).toContain("adminCreateBookingDraftFacade");
    expect(draftRoute).not.toContain("finalizePaidBooking");
  });
});
