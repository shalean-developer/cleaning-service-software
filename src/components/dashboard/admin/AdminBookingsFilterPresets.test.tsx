import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingsFilterPresets } from "./AdminBookingsFilterPresets";

describe("AdminBookingsFilterPresets", () => {
  it("renders preset chips with correct filter links", () => {
    const html = renderToStaticMarkup(
      <AdminBookingsFilterPresets filter="payment_failed" search="acme" />,
    );

    expect(html).toContain('aria-label="Booking list presets"');
    expect(html).toContain("Needs attention");
    expect(html).toContain("Payment issues");
    expect(html).toContain('href="/admin/bookings?filter=assignment_attention&amp;q=acme"');
    expect(html).toContain('href="/admin/bookings?filter=payment_failed&amp;q=acme"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("sm:flex-wrap");
    expect(html).toContain("sm:overflow-visible");
  });
});
