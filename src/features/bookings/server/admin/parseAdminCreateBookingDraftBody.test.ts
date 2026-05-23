import { describe, expect, it } from "vitest";
import { parseAdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";

describe("parseAdminCreateBookingDraftBody", () => {
  it("accepts a valid draft payload", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "valid-key-12345678",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects missing idempotencyKey", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects unsupported recurring interval in draft payload", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "valid-key-12345678",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "weekly",
      },
      recurringSchedule: {
        selectedDays: [1],
        intervalWeeks: 4,
        configuredVia: "admin_wizard_custom",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("not supported yet");
    }
  });

  it("defaults billing mode to paystack_link when omitted", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "valid-key-12345678",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.billing.mode).toBe("paystack_link");
  });

  it("rejects monthly_account payload missing required billing fields", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "valid-key-12345678",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
      billing: { mode: "monthly_account" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("monthlyAccountId");
    }
  });

  it("rejects weekly cadence on deep cleaning", () => {
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = parseAdminCreateBookingDraftBody({
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "valid-key-12345678",
      scheduledStart: start,
      scheduledEnd: end,
      pricingInput: {
        serviceSlug: "deep-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "weekly",
      },
      address: {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("once-off");
    }
  });
});
