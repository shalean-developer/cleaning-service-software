import { describe, expect, it } from "vitest";
import { SERVICE_SLUGS } from "@/features/pricing/server/types";
import {
  enrichBookingDisplayWithAssignmentVisibility,
  parseBookingDisplay,
  resolveServiceSlugFromMetadata,
  serviceLabelFromSlug,
} from "./parseBookingDisplay";

describe("resolveServiceSlugFromMetadata", () => {
  it("reads top-level metadata.serviceSlug", () => {
    expect(
      resolveServiceSlugFromMetadata({ serviceSlug: "regular-cleaning", suburb: "Sea Point" }),
    ).toBe("regular-cleaning");
  });

  it("reads nested metadata.quote.input.serviceSlug (wizard shape)", () => {
    expect(
      resolveServiceSlugFromMetadata({
        quote: { input: { serviceSlug: "deep-cleaning", bedrooms: 2, bathrooms: 1 } },
        suburb: "Sea Point",
      }),
    ).toBe("deep-cleaning");
  });

  it("prefers top-level slug over nested quote input", () => {
    expect(
      resolveServiceSlugFromMetadata({
        serviceSlug: "airbnb-cleaning",
        quote: { input: { serviceSlug: "regular-cleaning" } },
      }),
    ).toBe("airbnb-cleaning");
  });

  it("reads locked_service_slug snapshot on metadata", () => {
    expect(
      resolveServiceSlugFromMetadata({
        locked_service_slug: "moving-cleaning",
        quote: { input: { serviceSlug: "regular-cleaning" } },
      }),
    ).toBe("moving-cleaning");
  });

  it("returns null when no slug is present", () => {
    expect(resolveServiceSlugFromMetadata({ suburb: "Sea Point" })).toBeNull();
    expect(resolveServiceSlugFromMetadata(null)).toBeNull();
  });
});

describe("serviceLabelFromSlug", () => {
  it("maps all six catalog slugs to display labels", () => {
    const expected: Record<(typeof SERVICE_SLUGS)[number], string> = {
      "regular-cleaning": "Regular Cleaning",
      "deep-cleaning": "Deep Cleaning",
      "moving-cleaning": "Moving Cleaning",
      "airbnb-cleaning": "Airbnb Cleaning",
      "office-cleaning": "Office Cleaning",
      "carpet-cleaning": "Carpet Cleaning",
    };

    for (const slug of SERVICE_SLUGS) {
      expect(serviceLabelFromSlug(slug)).toBe(expected[slug]);
    }
  });

  it("falls back safely for unknown slug", () => {
    expect(serviceLabelFromSlug("not-a-real-service")).toBe("Cleaning service");
  });

  it('returns "Cleaning service" when slug is missing', () => {
    expect(serviceLabelFromSlug(null)).toBe("Cleaning service");
  });
});

describe("parseBookingDisplay", () => {
  it("reads contactPhone from metadata", () => {
    const display = parseBookingDisplay({
      contactPhone: "+27821234567",
    });
    expect(display.contactPhone).toBe("+27821234567");
    expect(display.contactPhoneDisplay).toBe("082 123 4567");
  });

  it("labels wizard metadata with nested quote input", () => {
    const display = parseBookingDisplay({
      quote: { input: { serviceSlug: "office-cleaning" } },
    });
    expect(display.serviceSlug).toBe("office-cleaning");
    expect(display.serviceLabel).toBe("Office Cleaning");
  });

  it("labels top-level metadata.serviceSlug", () => {
    const display = parseBookingDisplay({ serviceSlug: "carpet-cleaning" });
    expect(display.serviceLabel).toBe("Carpet Cleaning");
  });

  it("enriches customer calm copy during decline redispatch", () => {
    const metadata = {
      assignment: {
        status: "offered",
        path: "best_available",
        cleanerId: "c-2",
        offerId: "o-2",
        reason: null,
        attemptedAt: "2026-05-17T10:00:00.000Z",
        engineVersion: "2026-05-16-phase8",
      },
    };
    const base = parseBookingDisplay(metadata);
    const enriched = enrichBookingDisplayWithAssignmentVisibility(base, {
      bookingStatus: "pending_assignment",
      metadata,
      hasOpenOffer: true,
      offerStatuses: ["declined", "offered"],
    });
    expect(enriched.assignmentVisibilityKey).toBe("decline_redispatched");
    expect(enriched.assignmentCustomerMessage).toBe(
      "We're finding another available cleaner.",
    );
    expect(enriched.showCustomerAssignmentWarning).toBe(false);
  });
});
