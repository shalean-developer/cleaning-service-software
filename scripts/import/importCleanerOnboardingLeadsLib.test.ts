import { describe, expect, it } from "vitest";
import { parseCsv } from "./importCleanersLib";
import {
  buildOnboardingLeadsPlan,
  findRowByName,
  leadsForCsvExport,
  normalizeOnboardingLeadRow,
  summarizeOnboardingLeadsPlan,
} from "./importCleanerOnboardingLeadsLib";

const BATCH_CSV = `full_name,phone
Lorraine Moyo,+27680284159
Silibaziso Moyo,+27845559202
Natasha Magashito,+27678316466
Fungai Chipandambira,+27625593071
Ngwira Madalitso,+27680582573
Normatter Mazhinji,+27746987750
Magaret Jiri,+27792022641
Shelaine Kondo,+27682788771
Nicole James,+27694069060
Chido Chatsika,+27622418511
Sinikiwe Murire,+27843640805
Chrissy Roman,+27752175328
Lucia Chiuta,+27785567309
Nyasha Mudani,+27602483232
Princess Saidi,+27825915525
Omega Sanangurai,+27848410059
Shyleen Pfende,+27641940583
Vimbai Dhliwayo,+27601217706
Ethel Chizombe,+27743214943
Mavis Thandeka Gurajena,+27629474955
Mitchell Piyo,+27607222189
Estery Phiri,+27691445709
Fadzai Manditani,+27611829583
Rutendo Shamba,+27842676534
Elizabeth Chitekedza,+27814822897
Marvellous Muneri,+27603634903
`;

describe("importCleanerOnboardingLeadsLib", () => {
  it("normalizes phone to +27 E.164", () => {
    const row = normalizeOnboardingLeadRow({ full_name: "Test", phone: "0821234567" }, 2);
    expect(row?.phoneE164).toBe("+27821234567");
    expect(row?.status).toBe("needs_auth_invite");
  });

  it("deduplicates by phone within CSV", () => {
    const csv = `full_name,phone
Alice One,+27680284159
Bob Two,+27680284159
`;
    const plan = buildOnboardingLeadsPlan(parseCsv(csv), new Map());
    const summary = summarizeOnboardingLeadsPlan(plan);
    expect(summary.totalRows).toBe(2);
    expect(summary.duplicateCsv).toBe(1);
    expect(summary.needsAuthInvite).toBe(1);
  });

  it("skips existing cleaner by phone without marking active", () => {
    const rows = parseCsv(`full_name,phone\nPrincess Saidi,+27825915525\n`);
    const existing = new Map([
      [
        "+27825915525",
        {
          cleanerId: "2c065922-926e-4495-9520-7e798b60c8a5",
          profileId: "eb7ee6e0-d90d-4372-abc7-f506c77cb104",
          active: false,
        },
      ],
    ]);
    const plan = buildOnboardingLeadsPlan(rows, existing);
    const princess = findRowByName(plan, "Princess Saidi");
    expect(princess?.status).toBe("existing_cleaner");
    expect(princess?.active).toBe(false);
    expect(princess?.includedInLeadsCsv).toBe(false);
    expect(princess?.existingCleanerId).toBe("2c065922-926e-4495-9520-7e798b60c8a5");
  });

  it("processes full batch: 26 rows, Princess skip when present, 25 invite leads", () => {
    const existing = new Map([
      [
        "+27825915525",
        {
          cleanerId: "2c065922-926e-4495-9520-7e798b60c8a5",
          profileId: "eb7ee6e0-d90d-4372-abc7-f506c77cb104",
          active: true,
        },
      ],
    ]);
    const plan = buildOnboardingLeadsPlan(parseCsv(BATCH_CSV), existing);
    const summary = summarizeOnboardingLeadsPlan(plan);
    expect(summary.totalRows).toBe(26);
    expect(summary.existingCleaner).toBe(1);
    expect(summary.needsAuthInvite).toBe(25);
    expect(summary.includedInLeadsCsv).toBe(25);
    expect(leadsForCsvExport(plan).every((r) => r.status === "needs_auth_invite")).toBe(true);
    expect(leadsForCsvExport(plan).every((r) => r.active === false)).toBe(true);
  });

  it("marks all invite candidates as needs_auth_invite with active false", () => {
    const plan = buildOnboardingLeadsPlan(parseCsv(BATCH_CSV), new Map());
    const summary = summarizeOnboardingLeadsPlan(plan);
    expect(summary.totalRows).toBe(26);
    expect(summary.needsAuthInvite).toBe(26);
    for (const row of leadsForCsvExport(plan)) {
      expect(row.status).toBe("needs_auth_invite");
      expect(row.active).toBe(false);
    }
  });
});
