import { describe, expect, it } from "vitest";
import { cleanerApplicationSubmitSchema } from "./schema";

describe("cleanerApplicationSubmitSchema", () => {
  const base = {
    fullName: "Thandi Nkosi",
    phone: "0821234567",
    suburb: "Sea Point",
    city: "Cape Town",
    availabilityDays: [1],
    preferredAreas: ["Sea Point"],
    hasOwnTransport: true,
    workPreferences: ["regular_home_cleaning" as const],
    experienceLevel: "1_3_years" as const,
    workedInHomes: true,
    airbnbExperience: false,
    skills: {
      laundry: false,
      ironing: false,
      officeCleaning: false,
      petsOkay: false,
      familyHomesOkay: false,
    },
    consent: true as const,
  };

  it("generates shalean.co.za email from phone on parse", () => {
    const parsed = cleanerApplicationSubmitSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("0821234567@shalean.co.za");
      expect(parsed.data.email.endsWith("@shalean.co.za")).toBe(true);
    }
  });

  it("fails when phone cannot produce identity", () => {
    const parsed = cleanerApplicationSubmitSchema.safeParse({
      ...base,
      phone: "0111234567",
    });
    expect(parsed.success).toBe(false);
  });
});
