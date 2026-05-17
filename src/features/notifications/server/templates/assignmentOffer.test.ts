import { describe, expect, it } from "vitest";
import { buildAssignmentOfferEmail } from "./assignmentOffer";

describe("assignmentOffer email template", () => {
  it("includes safe job details and dashboard CTA only", () => {
    const content = buildAssignmentOfferEmail({
      cleanerDisplayName: "Jordan",
      serviceLabel: "Standard cleaning",
      scheduleLabel: "Mon 1 Jun, 10:00 – 12:00",
      locationLabel: "Sea Point, Cape Town",
      earningsLabel: "R 450.00",
      expiresAtLabel: "3 Jun 2026, 10:00",
      offersPageUrl: "https://app.example.com/cleaner/offers",
      supportEmail: "help@shalean.co.za",
    });

    expect(content.subject).toBe("New Shalean cleaning job offer");
    expect(content.text).toContain("Hi Jordan,");
    expect(content.text).toContain("Standard cleaning");
    expect(content.text).toContain("Sea Point, Cape Town");
    expect(content.text).toContain("R 450.00");
    expect(content.text).toContain("accept or decline from your cleaner dashboard");
    expect(content.text).toContain("https://app.example.com/cleaner/offers");
    expect(content.text).not.toMatch(/attention_required/i);
    expect(content.text).not.toMatch(/customer@/i);
    expect(content.text).not.toContain("/accept");
    expect(content.text).not.toContain("/decline");
  });

  it("omits earnings amount when preview unavailable", () => {
    const content = buildAssignmentOfferEmail({
      cleanerDisplayName: null,
      serviceLabel: "Deep clean",
      scheduleLabel: "Tue 2 Jun, 08:00 – 10:00",
      locationLabel: "Claremont, Cape Town",
      earningsLabel: null,
      expiresAtLabel: null,
      offersPageUrl: "https://app.example.com/cleaner/offers",
      supportEmail: null,
    });

    expect(content.text).toContain("Earnings: shown in your cleaner dashboard");
    expect(content.text).not.toContain("R 0");
    expect(content.text).not.toContain("Estimated earnings:");
  });

  it("does not include street address in area line", () => {
    const content = buildAssignmentOfferEmail({
      cleanerDisplayName: "Jordan",
      serviceLabel: "Standard cleaning",
      scheduleLabel: "Mon 1 Jun, 10:00 – 12:00",
      locationLabel: "Area available in dashboard",
      earningsLabel: null,
      expiresAtLabel: null,
      offersPageUrl: "https://cleaning-service-software.vercel.app/cleaner/offers",
      supportEmail: null,
    });

    expect(content.text).toContain("Area: Area available in dashboard");
    expect(content.text).not.toMatch(/Secret Street|line1|street address/i);
    expect(content.html).toContain("https://cleaning-service-software.vercel.app/cleaner/offers");
    expect(content.html).not.toContain("localhost");
  });
});
