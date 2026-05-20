import { describe, expect, it } from "vitest";
import { INITIAL_WIZARD_STATE } from "./types";
import {
  extractLatestBookingAddressDefaults,
  initialAddressFields,
  mergeLoadedWizardAddressDefaults,
} from "./latestBookingAddressDefaults";

describe("extractLatestBookingAddressDefaults", () => {
  it("reads nested address and top-level suburb/city", () => {
    expect(
      extractLatestBookingAddressDefaults({
        suburb: "Sea Point",
        city: "Cape Town",
        address: {
          line1: "12 Main Rd",
          suburb: "Sea Point",
          city: "Cape Town",
          notes: "Gate code 4455",
        },
      }),
    ).toEqual({
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
      locationNotes: "Gate code 4455",
    });
  });

  it("falls back to address.suburb and address.city when top-level missing", () => {
    expect(
      extractLatestBookingAddressDefaults({
        address: {
          line1: "5 Oak Ave",
          suburb: "Claremont",
          city: "Cape Town",
        },
      }),
    ).toEqual({
      addressLine1: "5 Oak Ave",
      suburb: "Claremont",
      city: "Cape Town",
    });
  });

  it("prefers top-level suburb over nested when both present", () => {
    expect(
      extractLatestBookingAddressDefaults({
        suburb: "Observatory",
        address: { line1: "1 A St", suburb: "Sea Point", city: "Cape Town" },
      }),
    ).toMatchObject({
      addressLine1: "1 A St",
      suburb: "Observatory",
      city: "Cape Town",
    });
  });

  it("returns empty object for null or invalid metadata", () => {
    expect(extractLatestBookingAddressDefaults(null)).toEqual({});
    expect(extractLatestBookingAddressDefaults([])).toEqual({});
    expect(extractLatestBookingAddressDefaults("x")).toEqual({});
  });

  it("ignores whitespace-only strings", () => {
    expect(
      extractLatestBookingAddressDefaults({
        suburb: "  ",
        address: { line1: "  ", notes: "\n" },
      }),
    ).toEqual({});
  });
});

describe("initialAddressFields", () => {
  const stored = {
    addressLine1: "",
    suburb: "",
    city: "",
    locationNotes: "",
  };

  it("fills empty stored fields from defaults", () => {
    expect(
      initialAddressFields(stored, {
        addressLine1: "12 Main Rd",
        suburb: "Sea Point",
        city: "Cape Town",
        locationNotes: "Ring bell",
      }),
    ).toEqual({
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
      locationNotes: "Ring bell",
    });
  });

  it("does not overwrite non-empty stored values", () => {
    expect(
      initialAddressFields(
        {
          addressLine1: "99 Saved St",
          suburb: "Woodstock",
          city: "",
          locationNotes: "",
        },
        {
          addressLine1: "12 Main Rd",
          suburb: "Sea Point",
          city: "Cape Town",
          locationNotes: "Gate code",
        },
      ),
    ).toEqual({
      addressLine1: "99 Saved St",
      suburb: "Woodstock",
      city: "Cape Town",
      locationNotes: "Gate code",
    });
  });

  it("returns stored unchanged when defaults are null", () => {
    const input = { ...stored, suburb: "Kenilworth" };
    expect(initialAddressFields(input, null)).toEqual(input);
  });

  it("uses empty object fallback without overwriting stored values", () => {
    expect(initialAddressFields({ ...stored, suburb: "Saved" }, {})).toEqual({
      ...stored,
      suburb: "Saved",
    });
  });
});

describe("mergeLoadedWizardAddressDefaults", () => {
  it("preserves step and service when applying latest booking defaults", () => {
    const loaded = {
      ...INITIAL_WIZARD_STATE,
      step: "location" as const,
      serviceSlug: "regular-cleaning" as const,
    };
    const merged = mergeLoadedWizardAddressDefaults(loaded, {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    });
    expect(merged.step).toBe("location");
    expect(merged.serviceSlug).toBe("regular-cleaning");
    expect(merged.addressLine1).toBe("12 Main Rd");
    expect(merged.suburb).toBe("Sea Point");
    expect(merged.city).toBe("Cape Town");
  });

  it("keeps loaded wizard state when defaults are null", () => {
    const loaded = { ...INITIAL_WIZARD_STATE, step: "location" as const, suburb: "Woodstock" };
    const merged = mergeLoadedWizardAddressDefaults(loaded, null);
    expect(merged).toEqual(loaded);
  });

  it("does not apply defaults when metadata extraction is empty", () => {
    const loaded = { ...INITIAL_WIZARD_STATE, step: "location" as const };
    expect(mergeLoadedWizardAddressDefaults(loaded, {})).toEqual(loaded);
  });

  it("localStorage values override latest booking defaults", () => {
    const loaded = {
      ...INITIAL_WIZARD_STATE,
      step: "location" as const,
      addressLine1: "99 Saved St",
      suburb: "Woodstock",
    };
    const merged = mergeLoadedWizardAddressDefaults(loaded, {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    });
    expect(merged.addressLine1).toBe("99 Saved St");
    expect(merged.suburb).toBe("Woodstock");
    expect(merged.city).toBe("Cape Town");
  });
});
