import { describe, expect, it } from "vitest";
import { CHECKOUT_EXPIRED_FAILURE_REASON } from "@/features/bookings/server/paymentFailureDisplay";
import {
  AIRBNB_CLEANING_SLUG,
  getAirbnbCustomerBookingDetailCopy,
  getAirbnbCustomerBookingListCopy,
  getAirbnbCustomerPaymentIssueCopy,
  getAirbnbCustomerPaymentVerifyErrorCopy,
  getAirbnbCustomerSuccessCopy,
  isAirbnbCleaningService,
} from "./airbnbCustomerDisplay";

describe("airbnbCustomerDisplay", () => {
  it("identifies Airbnb cleaning service slug", () => {
    expect(isAirbnbCleaningService(AIRBNB_CLEANING_SLUG)).toBe(true);
    expect(isAirbnbCleaningService("regular-cleaning")).toBe(false);
  });

  it("returns host-focused payment success copy", () => {
    const copy = getAirbnbCustomerSuccessCopy("confirmed");
    expect(copy.title).toContain("turnover is confirmed");
    expect(copy.nextSteps.some((s) => s.title === "Cleaner assignment")).toBe(true);
    expect(copy.guestReadyNote).toContain("guest arrival");
    expect(copy.ctaLabel).toBe("View turnover details");
  });

  it("returns host-focused payment issue copy", () => {
    const copy = getAirbnbCustomerPaymentIssueCopy(CHECKOUT_EXPIRED_FAILURE_REASON);
    expect(copy.title).toContain("not confirmed yet");
    expect(copy.body).toContain("property preparation");
    expect(copy.slotWarning).toContain("turnover slot");
  });

  it("returns turnover verify-error copy without internal terms", () => {
    const copy = getAirbnbCustomerPaymentVerifyErrorCopy();
    expect(copy.panelTitle.toLowerCase()).not.toContain("webhook");
    expect(copy.intro).toContain("payment");
  });

  it("returns compact list subtitles and badges for upcoming turnovers", () => {
    const copy = getAirbnbCustomerBookingListCopy({
      status: "pending_assignment",
      paymentFailureReason: null,
      isUpcoming: true,
    });
    expect(copy.statusBadgeLabel).toBe("Finding your cleaner");
    expect(copy.serviceSubtitle).toBe("Guest-ready preparation scheduled");
    expect(copy.ctaLabel).toBe("View turnover");
  });

  it("returns booking detail field labels for hosts", () => {
    const copy = getAirbnbCustomerBookingDetailCopy();
    expect(copy.detailsSectionTitle).toBe("Turnover details");
    expect(copy.notesLabel).toBe("Host instructions");
    expect(copy.serviceHeroTitle).toBe("Guest-ready turnover");
  });
});
