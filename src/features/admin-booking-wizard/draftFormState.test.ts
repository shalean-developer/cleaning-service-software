import { describe, expect, it } from "vitest";
import {
  buildAdminDraftRequestBody,
  isAdminDraftFormReadyForSave,
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
} from "./draftFormState";

describe("admin booking wizard draft form", () => {
  it("is not ready when required fields are missing", () => {
    expect(isAdminDraftFormReadyForSave(EMPTY_ADMIN_BOOKING_WIZARD_FORM)).toBe(false);
  });

  it("requires selectedCustomer for save readiness", () => {
    expect(
      isAdminDraftFormReadyForSave({
        ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
        customerId: "11111111-1111-4111-8111-111111111111",
        serviceSlug: "regular-cleaning",
        date: "2099-06-01",
        time: "09:00",
        addressLine1: "12 Main",
        suburb: "Sea Point",
        city: "Cape Town",
      }),
    ).toBe(false);
  });

  it("builds request body with composed address notes", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const date = future.toISOString().slice(0, 10);

    const body = buildAdminDraftRequestBody(
      {
        ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
        customerId: "11111111-1111-4111-8111-111111111111",
        selectedCustomer: {
          customerId: "11111111-1111-4111-8111-111111111111",
          label: "Test",
          email: null,
          phone: null,
        },
        serviceSlug: "regular-cleaning",
        date,
        time: "09:00",
        addressLine1: "12 Main",
        suburb: "Sea Point",
        city: "Cape Town",
        accessInstructions: "Ring bell",
        petNotes: "Cat indoors",
        addons: ["inside-fridge"],
        requestedTeamSize: 2,
      },
      "idem-key-12345678",
    );

    expect(body?.address.locationNotes).toContain("Access: Ring bell");
    expect(body?.address.specialInstructions).toContain("Pets: Cat indoors");
    expect(body?.pricingInput.addons).toEqual(["inside-fridge"]);
    expect(body?.pricingInput.requestedTeamSize).toBe(2);
  });
});
