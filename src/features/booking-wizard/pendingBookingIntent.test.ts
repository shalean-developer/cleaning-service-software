import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  applyPendingBookingIntentToWizardState,
  buildPendingBookingRedirectTarget,
  heroQuoteLocationToWizardAddress,
  savePendingBookingIntent,
  loadPendingBookingIntent,
  consumePendingBookingIntentForService,
  PENDING_BOOKING_INTENT_STORAGE_KEY,
  clearPendingBookingIntent,
} from "./pendingBookingIntent";
import { INITIAL_WIZARD_STATE } from "./types";

describe("pendingBookingIntent", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
    clearPendingBookingIntent();
  });

  it("builds canonical customer book redirect target", () => {
    expect(buildPendingBookingRedirectTarget("regular-cleaning")).toBe(
      "/customer/book/regular-cleaning",
    );
  });

  it("saves and loads intent from localStorage", () => {
    savePendingBookingIntent({
      serviceSlug: "deep-cleaning",
      bedrooms: 3,
      bathrooms: 2,
      date: "2026-06-01",
      locationLabel: "Sea Point, Cape Town",
      estimatedPriceCents: 45000,
    });

    const loaded = loadPendingBookingIntent();
    expect(loaded?.serviceSlug).toBe("deep-cleaning");
    expect(loaded?.bedrooms).toBe(3);
    expect(loaded?.redirectTarget).toBe("/customer/book/deep-cleaning");
  });

  it("consumes intent only for matching service", () => {
    savePendingBookingIntent({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      date: "2026-06-01",
      locationLabel: "Claremont, Cape Town",
      estimatedPriceCents: 25000,
    });

    expect(consumePendingBookingIntentForService("deep-cleaning")).toBeNull();
    expect(loadPendingBookingIntent()).not.toBeNull();

    const consumed = consumePendingBookingIntentForService("regular-cleaning");
    expect(consumed?.serviceSlug).toBe("regular-cleaning");
    expect(loadPendingBookingIntent()).toBeNull();
  });

  it("maps hero suburb labels to wizard address fields", () => {
    expect(heroQuoteLocationToWizardAddress("Wynberg, Cape Town")).toEqual({
      suburb: "Wynberg",
      city: "Cape Town",
    });
    expect(heroQuoteLocationToWizardAddress("Other Cape Town area")).toEqual({
      suburb: "",
      city: "Cape Town",
    });
  });

  it("hydrates wizard state with date and location", () => {
    const intent = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      serviceSlug: "regular-cleaning" as const,
      bedrooms: 4,
      bathrooms: 3,
      date: "2026-07-15",
      locationLabel: "Bellville, Cape Town",
      estimatedPriceCents: 30000,
      redirectTarget: "/customer/book/regular-cleaning",
    };

    const next = applyPendingBookingIntentToWizardState(INITIAL_WIZARD_STATE, intent);
    expect(next.bedrooms).toBe(4);
    expect(next.bathrooms).toBe(3);
    expect(next.date).toBe("2026-07-15");
    expect(next.suburb).toBe("Bellville");
    expect(next.city).toBe("Cape Town");
    expect(next.step).toBe("datetime");
  });

  it("uses storage key shalean_pending_booking_intent", () => {
    savePendingBookingIntent({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      date: "2026-06-01",
      locationLabel: "Sea Point, Cape Town",
      estimatedPriceCents: 25000,
    });
    expect(storage.get(PENDING_BOOKING_INTENT_STORAGE_KEY)).toBeTruthy();
  });
});
