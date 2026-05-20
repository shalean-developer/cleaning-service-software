import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingDetailSectionNav } from "./AdminBookingDetailSectionNav";

describe("AdminBookingDetailSectionNav", () => {
  it("renders anchor links for operational sections", () => {
    const html = renderToStaticMarkup(<AdminBookingDetailSectionNav />);
    expect(html).toContain('href="#admin-booking-overview"');
    expect(html).toContain('href="#admin-booking-assignment"');
    expect(html).toContain('href="#admin-booking-payments"');
    expect(html).toContain('href="#admin-booking-timeline"');
    expect(html).toContain('href="#admin-booking-records"');
    expect(html).toContain("Overview");
    expect(html).toContain("Assignment");
  });

  it("marks the active section with aria-current when overridden", () => {
    const html = renderToStaticMarkup(
      <AdminBookingDetailSectionNav activeSection="payments" />,
    );
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Payments");
    expect(html).toContain("bg-zinc-900 text-white");
  });
});
