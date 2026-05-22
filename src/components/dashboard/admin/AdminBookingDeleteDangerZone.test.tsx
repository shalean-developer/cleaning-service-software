import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingDeleteDangerZone } from "./AdminBookingDeleteDangerZone";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const baseProps = {
  bookingId: "booking-1",
  status: "draft" as const,
  paymentStatus: null,
  hasEarningLines: false,
  hardDeleteAllowed: true,
  hardDeleteBlockedReasons: [] as string[],
};

describe("AdminBookingDeleteDangerZone", () => {
  it("shows archive and permanent delete when booking is active", () => {
    const html = renderToStaticMarkup(
      <AdminBookingDeleteDangerZone {...baseProps} deletedAt={null} />,
    );
    expect(html).toContain("Archive booking");
    expect(html).toContain("Permanently delete booking");
  });

  it("shows permanent delete but not archive when booking is archived", () => {
    const html = renderToStaticMarkup(
      <AdminBookingDeleteDangerZone
        {...baseProps}
        deletedAt="2026-05-22T17:29:43.000Z"
      />,
    );
    expect(html).toContain("This booking was archived on");
    expect(html).toContain("Permanently delete booking");
    expect(html).not.toContain("Archive booking");
  });

  it("disables permanent delete when hard delete is blocked", () => {
    const html = renderToStaticMarkup(
      <AdminBookingDeleteDangerZone
        {...baseProps}
        deletedAt="2026-05-22T17:29:43.000Z"
        hardDeleteAllowed={false}
        hardDeleteBlockedReasons={["paid or refunded payment exists"]}
      />,
    );
    expect(html).toContain("Permanently delete booking");
    expect(html).toContain("paid or refunded payment exists");
    expect(html).toMatch(/disabled=""/);
  });
});
