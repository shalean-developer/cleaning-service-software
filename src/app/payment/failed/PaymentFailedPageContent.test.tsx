import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import { CHECKOUT_EXPIRED_FAILURE_REASON } from "@/features/bookings/server/paymentFailureDisplay";
import { PaymentFailedPageContent } from "./PaymentFailedPageContent";

const bookingId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("PaymentFailedPageContent", () => {
  it("renders generic failed page with my bookings fallback", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedPageContent model={buildPaymentFailedPageModel({})} />,
    );
    expect(html).toContain("Payment not completed");
    expect(html).toContain("Complete checkout to confirm your booking");
    expect(html).toContain("Go to my bookings");
    expect(html).not.toContain("View booking to retry payment");
  });

  it("renders checkout_expired copy when reason is known", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedPageContent
        model={buildPaymentFailedPageModel({ reason: CHECKOUT_EXPIRED_FAILURE_REASON })}
      />,
    );
    expect(html).toContain("checkout timed out");
    expect(html).toContain("You were not charged");
    expect(html).toContain("What happens next");
    expect(html).toContain("Book a clean");
  });

  it("renders Airbnb turnover failure copy when service param is airbnb-cleaning", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedPageContent
        model={buildPaymentFailedPageModel({
          service: "airbnb-cleaning",
          reason: CHECKOUT_EXPIRED_FAILURE_REASON,
        })}
      />,
    );
    expect(html).toContain("turnover booking is not confirmed yet");
    expect(html).toContain("property preparation slot");
    expect(html).toContain("turnover slot may be released");
  });

  it("shows booking retry CTA when booking id is present", () => {
    const html = renderToStaticMarkup(
      <PaymentFailedPageContent
        model={buildPaymentFailedPageModel({ bookingId })}
      />,
    );
    expect(html).toContain("Open booking to complete payment");
    expect(html).toContain(`/customer/bookings/${bookingId}`);
    expect(html).toContain("A1B2C3D4");
  });
});
