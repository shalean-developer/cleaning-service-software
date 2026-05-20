import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PaymentConfirmedPanel,
  PaymentVerifyingPanel,
  PaymentVerifyTrustRow,
} from "./PaymentReturnPanels";

describe("PaymentReturnPanels", () => {
  it("renders verifying panel with Paystack trust row", () => {
    const html = renderToStaticMarkup(
      <PaymentVerifyingPanel statusMessage="Confirming your payment…" />,
    );
    expect(html).toContain("Secured by Paystack");
    expect(html).toContain("Confirming your payment");
    expect(html).toContain("Keep this window open");
  });

  it("renders Airbnb turnover success copy when service slug is airbnb-cleaning", () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmedPanel
        variant="confirmed"
        bookingDetailHref="/customer/bookings/abc"
        serviceSlug="airbnb-cleaning"
      />,
    );
    expect(html).toContain("turnover is confirmed");
    expect(html).toContain("guest-ready preparation");
    expect(html).toContain("View turnover details");
    expect(html).not.toContain("Booking confirmed");
  });

  it("renders confirmed panel with next steps and booking CTA", () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmedPanel
        variant="confirmed"
        bookingDetailHref="/customer/bookings/abc"
      />,
    );
    expect(html).toContain("Booking confirmed");
    expect(html).toContain("What happens next");
    expect(html).toContain("Email updates");
    expect(html).toContain("View booking details");
    expect(html).toContain("Opening your booking");
  });

  it("renders trust row for checkout continuity", () => {
    const html = renderToStaticMarkup(<PaymentVerifyTrustRow />);
    expect(html).toContain("border-emerald-100");
  });
});
